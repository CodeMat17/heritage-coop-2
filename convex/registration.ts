import { action, internalMutation, internalQuery } from "./_generated/server";
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
    if (!user) return { status: "not_found" as const };
    if (user.registrationPaid) return { status: "duplicate" as const };

    await ctx.db.patch(userId, {
      registrationPaid: true,
      registrationPaidAt: paidAt,
      registrationAmountPaid: amountPaid,
    });

    return { status: "ok" as const };
  },
});

// Called by the Squad webhook route — validates secret before touching the DB.
export const processRegistrationPayment = action({
  args: {
    webhookSecret: v.string(),
    email: v.string(),
    transactionRef: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.webhookSecret !== process.env.CONVEX_WEBHOOK_SECRET) {
      console.error("Registration webhook: secret mismatch");
      return { status: "unauthorized" as const };
    }

    const user = await ctx.runQuery(internal.registration.getUserByEmail, {
      email: args.email,
    });

    if (!user) return { status: "not_found" as const };

    const requiredFee = user.selectedPackage
      ? (REGISTRATION_FEES[user.selectedPackage] ?? 0)
      : 0;

    if (args.amount < requiredFee) {
      console.warn(
        `Registration short payment: email=${args.email} paid=₦${args.amount} required=₦${requiredFee}`
      );
      return { status: "insufficient_amount" as const };
    }

    return await ctx.runMutation(internal.registration.markRegistrationPaid, {
      userId: user._id,
      transactionRef: args.transactionRef,
      paidAt: Date.now(),
      amountPaid: args.amount,
    });
  },
});
