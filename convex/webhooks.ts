import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Daily contribution rates per package (naira). Must stay in sync with the
// PACKAGES constant in app/dashboard/page.tsx.
const DAILY_RATES: Record<string, number> = {
  bronze:  500,
  silver:  1_000,
  gold:    2_000,
  diamond: 5_000,
  emerald: 10_000,
};

// Returns the next `count` calendar dates (YYYY-MM-DD) starting from today
// that are not already in `alreadyCovered`.
function computeNextUnpaidDates(alreadyCovered: Set<string>, count: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  let guard = 0;
  while (dates.length < count && guard < 730) {
    const iso = cursor.toISOString().split("T")[0];
    if (!alreadyCovered.has(iso)) dates.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return dates;
}

// Called by the frontend (via /api/squad/record) after Squad payment is verified.
// Uses Clerk identity — no webhook secret required.
// coveredDates are computed server-side from the verified amount and the user's
// package so the client cannot choose or manipulate which dates get credited.
export const recordVerifiedPayment = action({
  args: {
    transactionRef: v.string(),
    email: v.string(),         // from Squad's verified API response — not client input
    amount: v.number(),        // kobo, from Squad's verified API response
    currency: v.optional(v.string()),
    transactionStatus: v.string(),
    gatewayRef: v.optional(v.string()),
    squadCreatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "unauthorized" };

    if (args.transactionStatus.toLowerCase() !== "success") {
      return { status: "ignored", reason: "non-success status" };
    }

    // Idempotency: skip if already recorded
    const existing = await ctx.runQuery(internal.webhooks.getContributionByRef, {
      transactionRef: args.transactionRef,
    });
    if (existing) return { status: "duplicate" };

    // Look up user by Clerk externalId (subject from JWT) — this is the
    // authenticated caller, not whoever the client claims to be.
    const user = await ctx.runQuery(internal.webhooks.getUserByExternalId, {
      externalId: identity.subject,
    });
    if (!user) return { status: "user_not_found" };

    // The email on the Squad-verified transaction must match the DB user.
    // This prevents a logged-in user from claiming someone else's transaction ref.
    if (user.email.toLowerCase() !== args.email.toLowerCase()) {
      console.error(
        `recordVerifiedPayment: email mismatch — authenticated=${user.email}, squad_tx=${args.email}`
      );
      return { status: "email_mismatch" };
    }

    // Determine how many days this payment covers from the verified amount.
    // The client has no say in this — it is derived entirely from Squad's data.
    const amountNaira = Math.round(args.amount / 100);
    const pkg = user.selectedPackage ?? "";
    const dailyRate = DAILY_RATES[pkg];
    if (!dailyRate) {
      console.error(`recordVerifiedPayment: unknown package "${pkg}" for user ${user._id}`);
      return { status: "unknown_package" };
    }
    const daysCount = Math.max(1, Math.floor(amountNaira / dailyRate));

    // Compute which dates to credit server-side — client cannot influence this.
    const alreadyCovered = await ctx.runQuery(internal.webhooks.getCoveredDatesByUserId, {
      userId: user._id,
    });
    const coveredDates = computeNextUnpaidDates(alreadyCovered, daysCount);

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

    if (args.transactionStatus.toLowerCase() !== "success") {
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

    // Squad sends amount in kobo → convert to naira
    const amountNaira = Math.round(args.amount / 100);

    // Compute covered dates server-side from amount + package rate (same logic as
    // recordVerifiedPayment) so the webhook fallback credits the correct number of
    // days even if the client metadata is missing or truncated.
    const pkg = user.selectedPackage ?? "";
    const dailyRate = DAILY_RATES[pkg];
    if (!dailyRate) {
      console.error(`processSquadPayment: unknown package "${pkg}" for user ${user._id}`);
      return { status: "unknown_package" };
    }
    const daysCount = Math.max(1, Math.floor(amountNaira / dailyRate));
    const alreadyCovered = await ctx.runQuery(internal.webhooks.getCoveredDatesByUserId, {
      userId: user._id,
    });
    const coveredDates = computeNextUnpaidDates(alreadyCovered, daysCount);

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

export const getUserByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
      .unique();
  },
});

export const getCoveredDatesByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "success"))
      .collect();
    const allDates = new Set<string>();
    for (const c of contributions) {
      for (const d of c.coveredDates) allDates.add(d);
    }
    return allDates;
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
