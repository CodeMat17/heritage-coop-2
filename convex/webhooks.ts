import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const processSquadPayment = action({
  args: {
    webhookSecret: v.string(),
    transactionRef: v.string(),
    email: v.string(),
    amount: v.number(),
    merchantAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    transactionStatus: v.string(),
    transactionType: v.optional(v.string()),
    gatewayRef: v.optional(v.string()),
    paymentType: v.optional(v.string()),
    cardType: v.optional(v.string()),
    pan: v.optional(v.string()),
    tokenId: v.optional(v.string()),
    customerMobile: v.optional(v.string()),
    isRecurring: v.optional(v.boolean()),
    meta: v.optional(v.any()),
    merchantId: v.optional(v.string()),
    squadCreatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.webhookSecret !== process.env.CONVEX_WEBHOOK_SECRET) {
      console.error("Webhook secret mismatch");
      return { status: "unauthorized" };
    }

    if (args.transactionStatus !== "success") {
      return { status: "ignored", reason: "non-success status" };
    }

    const existing = await ctx.runQuery(internal.webhooks.getContributionByRef, {
      transactionRef: args.transactionRef,
    });
    if (existing) return { status: "duplicate" };

    const user = await ctx.runQuery(internal.webhooks.getUserByEmail, {
      email: args.email,
    });
    if (!user) return { status: "user_not_found" };

    const meta = args.meta as Record<string, unknown> | undefined;
    const coveredDatesRaw = meta?.coveredDates as string | undefined;
    const coveredDates: string[] = coveredDatesRaw
      ? coveredDatesRaw.split(",").map((d) => d.trim()).filter(Boolean)
      : [];
    const daysCount = coveredDates.length || 1;

    // Squad sends amount in kobo → convert to naira
    const amountNaira = Math.round(args.amount / 100);

    await ctx.runMutation(internal.webhooks.insertContribution, {
      userId: user._id,
      transactionRef: args.transactionRef,
      amount: amountNaira,
      daysCount,
      coveredDates,
      status: "success",
      gatewayRef: args.gatewayRef,
      currency: args.currency ?? "NGN",
      squadCreatedAt: args.squadCreatedAt,
    });

    return { status: "ok" };
  },
});

export const getContributionByRef = internalQuery({
  args: { transactionRef: v.string() },
  handler: async (ctx, { transactionRef }) => {
    return await ctx.db
      .query("userContributions")
      .withIndex("byTransactionRef", (q) => q.eq("transactionRef", transactionRef))
      .unique();
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("byEmail", (q) => q.eq("email", email))
      .unique();
  },
});

export const insertContribution = internalMutation({
  args: {
    userId: v.id("users"),
    transactionRef: v.string(),
    amount: v.number(),
    daysCount: v.number(),
    coveredDates: v.array(v.string()),
    status: v.string(),
    gatewayRef: v.optional(v.string()),
    currency: v.string(),
    squadCreatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("userContributions", args);
  },
});
