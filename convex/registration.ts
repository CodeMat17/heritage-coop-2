import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getUserByRegistrationRef = internalQuery({
  args: { registrationRef: v.string() },
  handler: async (ctx, { registrationRef }) => {
    return await ctx.db
      .query("users")
      .withIndex("byRegistrationRef", (q) => q.eq("registrationRef", registrationRef))
      .unique();
  },
});

export const markRegistrationPaid = internalMutation({
  args: {
    registrationRef: v.string(),
    transactionRef: v.string(),
    paidAt: v.number(),
  },
  handler: async (ctx, { registrationRef, transactionRef, paidAt }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("byRegistrationRef", (q) => q.eq("registrationRef", registrationRef))
      .unique();

    if (!user) return { status: "not_found" as const };
    if (user.registrationPaid) return { status: "duplicate" as const };

    await ctx.db.patch(user._id, {
      registrationPaid: true,
      registrationPaidAt: paidAt,
    });

    return { status: "ok" as const };
  },
});

// Called by the Squad webhook route — validates secret before touching the DB.
export const processRegistrationPayment = action({
  args: {
    webhookSecret: v.string(),
    registrationRef: v.string(),
    transactionRef: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.webhookSecret !== process.env.CONVEX_WEBHOOK_SECRET) {
      console.error("Registration webhook: secret mismatch");
      return { status: "unauthorized" as const };
    }

    return await ctx.runMutation(internal.registration.markRegistrationPaid, {
      registrationRef: args.registrationRef,
      transactionRef: args.transactionRef,
      paidAt: Date.now(),
    });
  },
});
