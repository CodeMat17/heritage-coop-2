import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const REGISTRATION_FEES: Record<string, number> = {
  bronze: 5_000,
  silver: 10_000,
  gold: 20_000,
  diamond: 30_000,
  emerald: 40_000,
};

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
  },
  handler: async (ctx, { userId, transactionRef, paidAt, amountPaid }) => {
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
    });

    return { status: "ok" as const, emailAlreadySent: false };
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

    const requiredFee = user.selectedPackage
      ? (REGISTRATION_FEES[user.selectedPackage] ?? 0)
      : 0;

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
