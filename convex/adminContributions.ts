import { action, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireRole, getRecordedByName } from "./lib/adminAuth";

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const recordCashContribution = action({
  args: {
    userId: v.id("users"),
    dates: v.array(v.string()),
  },
  handler: async (
    ctx,
    { userId, dates }
  ): Promise<{ status: "ok"; daysCount: number; coveredDates: string[] }> => {
    await requireRole(ctx, ["assist-admin"]);
    const identity = await ctx.auth.getUserIdentity();

    const user: {
      selectedPackage?: string;
      registrationPaid?: boolean;
      registrationPaidAt?: number;
    } | null = await ctx.runQuery(internal.adminContributions.getUser, { userId });
    if (!user) throw new Error("User not found");
    if (!user.registrationPaid || !user.registrationPaidAt) {
      throw new Error("Registration fee must be paid before contributions can be recorded.");
    }

    const pkgId = user.selectedPackage ?? "";
    const pkgRow = pkgId
      ? await ctx.runQuery(internal.packages.getByIdInternal, { packageId: pkgId })
      : null;
    const dailyRate = pkgRow?.daily;
    if (!dailyRate) throw new Error(`Unknown package "${pkgId}" for user ${userId}`);

    const registrationDate = new Date(user.registrationPaidAt);
    const registrationIso = `${registrationDate.getFullYear()}-${String(
      registrationDate.getMonth() + 1
    ).padStart(2, "0")}-${String(registrationDate.getDate()).padStart(2, "0")}`;

    const coveredArr: string[] = await ctx.runQuery(internal.webhooks.getCoveredDatesByUserId, {
      userId,
    });
    const alreadyCovered = new Set(coveredArr);
    const coveredDates = [...new Set(dates)].filter(
      (d) => !alreadyCovered.has(d) && d >= registrationIso
    );

    if (coveredDates.length < 1) {
      throw new Error(
        "No valid new dates selected — dates must be on/after the registration payment date and not already covered."
      );
    }

    const suffix = Math.floor(100000 + Math.random() * 900000);
    const transactionRef = `cash_con_${Date.now()}_${suffix}`;
    const amountNaira = dailyRate * coveredDates.length;

    await ctx.runMutation(internal.webhooks.insertContribution, {
      userId,
      transactionRef,
      amount: amountNaira,
      daysCount: coveredDates.length,
      coveredDates,
      status: "success",
      currency: "NGN",
      recordedBy: getRecordedByName(identity),
      paymentMethod: "cash",
    });

    return { status: "ok" as const, daysCount: coveredDates.length, coveredDates };
  },
});

// Lets an assist-admin remove a cash contribution recorded in error. Restricted
// to paymentMethod: "cash" rows — online (Squad) payments must never be
// deleted this way.
export const deleteCashContribution = mutation({
  args: { contributionId: v.id("userContributions") },
  handler: async (ctx, { contributionId }) => {
    await requireRole(ctx, ["assist-admin"]);

    const contribution = await ctx.db.get(contributionId);
    if (!contribution) throw new Error("Contribution not found");
    if (contribution.paymentMethod !== "cash") {
      throw new Error("Only cash-recorded contributions can be removed here.");
    }

    await ctx.db.delete(contributionId);
  },
});

// Lets an assist-admin remove specific over-marked day(s) from a cash
// contribution (e.g. 6 days recorded when only 4 were actually paid for),
// without wiping out the correctly-recorded days in the same row. The row's
// amount is shrunk proportionally (assumes a uniform per-day rate, which is
// always true since a single row is written for one package's daily rate).
// If every date is removed, the row is deleted outright.
export const removeCashContributionDates = mutation({
  args: {
    contributionId: v.id("userContributions"),
    dates: v.array(v.string()),
  },
  handler: async (ctx, { contributionId, dates }) => {
    await requireRole(ctx, ["assist-admin"]);

    const contribution = await ctx.db.get(contributionId);
    if (!contribution) throw new Error("Contribution not found");
    if (contribution.paymentMethod !== "cash") {
      throw new Error("Only cash-recorded contributions can be edited here.");
    }

    const toRemove = new Set(dates);
    const remainingDates = contribution.coveredDates.filter((d) => !toRemove.has(d));
    if (remainingDates.length === contribution.coveredDates.length) {
      throw new Error("None of the selected dates were found on this contribution.");
    }

    if (remainingDates.length === 0) {
      await ctx.db.delete(contributionId);
      return { status: "deleted" as const };
    }

    const perDay = contribution.amount / contribution.coveredDates.length;
    await ctx.db.patch(contributionId, {
      coveredDates: remainingDates,
      daysCount: remainingDates.length,
      amount: Math.round(perDay * remainingDates.length),
    });
    return { status: "updated" as const, remainingDates };
  },
});
