import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireRole, getRecordedByName } from "./lib/adminAuth";

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("byEmail", (q) => q.eq("email", email))
      .unique();
  },
});

export const markRegistrationPaid = internalMutation({
  args: {
    userId: v.id("users"),
    transactionRef: v.string(),
    paidAt: v.number(),
    amountPaid: v.number(),
    paymentMethod: v.optional(v.string()),
    recordedBy: v.optional(v.string()),
  },
  handler: async (ctx, { userId, transactionRef, paidAt, amountPaid, paymentMethod, recordedBy }) => {
    const user = await ctx.db.get(userId);
    if (!user) return { status: "not_found" as const, emailAlreadySent: false };
    if (user.registrationPaid) {
      return {
        status: "duplicate" as const,
        emailAlreadySent: user.registrationWelcomeEmailSent ?? false,
      };
    }

    await ctx.db.patch(userId, {
      registrationPaid: true,
      registrationPaidAt: paidAt,
      registrationAmountPaid: amountPaid,
      registrationRef: transactionRef,
      ...(paymentMethod ? { registrationPaymentMethod: paymentMethod } : {}),
      ...(recordedBy ? { registrationRecordedBy: recordedBy } : {}),
    });

    return { status: "ok" as const, emailAlreadySent: false };
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const markRegistrationPaidCash = action({
  args: {
    userId: v.id("users"),
    amountPaid: v.number(),
  },
  handler: async (ctx, { userId, amountPaid }): Promise<{ status: "ok" | "duplicate" }> => {
    await requireRole(ctx, ["assist-admin", "finance-assist-admin"]);
    const identity = await ctx.auth.getUserIdentity();

    const user: { selectedPackage?: string; registrationPaid?: boolean } | null =
      await ctx.runQuery(internal.registration.getUser, { userId });
    if (!user) throw new Error("User not found");
    if (user.registrationPaid) return { status: "duplicate" };

    const pkg = user.selectedPackage
      ? await ctx.runQuery(internal.packages.getByIdInternal, { packageId: user.selectedPackage })
      : null;
    const requiredFee = pkg?.regFee ?? 0;
    if (amountPaid < requiredFee) throw new Error("insufficient_amount");

    const suffix = Math.floor(100000 + Math.random() * 900000);
    const transactionRef = `cash_reg_${Date.now()}_${suffix}`;

    const result = await ctx.runMutation(internal.registration.markRegistrationPaid, {
      userId,
      transactionRef,
      paidAt: Date.now(),
      amountPaid,
      paymentMethod: "cash",
      recordedBy: getRecordedByName(identity),
    });

    return { status: result.status === "ok" ? "ok" : "duplicate" };
  },
});

export const markWelcomeEmailSent = mutation({
  args: { webhookSecret: v.string(), userId: v.id("users") },
  handler: async (ctx, { webhookSecret, userId }) => {
    if (webhookSecret !== process.env.CONVEX_WEBHOOK_SECRET) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(userId, { registrationWelcomeEmailSent: true });
  },
});

// Called by both the client-side verify route and the Squad webhook route.
// Returns enough data for the caller to send the welcome email when needed.
export const processRegistrationPayment = action({
  args: {
    webhookSecret: v.string(),
    email: v.string(),
    transactionRef: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<
    | { status: "unauthorized" }
    | { status: "not_found" }
    | { status: "insufficient_amount" }
    | {
        status: "ok";
        name: string;
        selectedPackage: string;
        paidAt: number;
        userId: string;
        emailAlreadySent: boolean;
      }
    | { status: "duplicate"; emailAlreadySent: boolean }
  > => {
    if (args.webhookSecret !== process.env.CONVEX_WEBHOOK_SECRET) {
      console.error("Registration webhook: secret mismatch");
      return { status: "unauthorized" };
    }

    const user: {
      _id: string;
      name: string;
      email: string;
      selectedPackage?: string;
      registrationPaid?: boolean;
      registrationWelcomeEmailSent?: boolean;
    } | null = await ctx.runQuery(internal.registration.getUserByEmail, {
      email: args.email,
    });

    if (!user) return { status: "not_found" };

    const pkg = user.selectedPackage
      ? await ctx.runQuery(internal.packages.getByIdInternal, { packageId: user.selectedPackage })
      : null;
    const requiredFee = pkg?.regFee ?? 0;

    if (args.amount < requiredFee) {
      console.warn(
        `Registration short payment: email=${args.email} paid=₦${args.amount} required=₦${requiredFee}`
      );
      return { status: "insufficient_amount" };
    }

    const paidAt = Date.now();
    const result = await ctx.runMutation(internal.registration.markRegistrationPaid, {
      userId: user._id as never,
      transactionRef: args.transactionRef,
      paidAt,
      amountPaid: args.amount,
    });

    if (result.status === "ok") {
      return {
        status: "ok" as const,
        name: user.name,
        selectedPackage: user.selectedPackage ?? "bronze",
        paidAt,
        userId: user._id,
        emailAlreadySent: false,
      };
    }

    if (result.status === "duplicate") {
      return { status: "duplicate" as const, emailAlreadySent: result.emailAlreadySent };
    }

    return { status: "not_found" };
  },
});
