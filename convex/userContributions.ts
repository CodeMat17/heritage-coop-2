import { query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const getMyContributions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getMyStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "success"))
      .collect();

    const allDates = new Set<string>();
    let totalAmount = 0;
    for (const c of contributions) {
      for (const d of c.coveredDates) allDates.add(d);
      totalAmount += c.amount;
    }

    const daysContributed = allDates.size;
    const daysRemaining = Math.max(0, 90 - daysContributed);
    const isLoanEligible = daysContributed >= 90;

    const sortedDates = Array.from(allDates).sort();
    const lastPayment =
      contributions.length > 0
        ? contributions.sort((a, b) =>
            (b._creationTime ?? 0) - (a._creationTime ?? 0)
          )[0]
        : null;

    return {
      daysContributed,
      daysRemaining,
      totalAmount,
      isLoanEligible,
      contributedDates: sortedDates,
      lastPaymentDate: lastPayment?._creationTime ?? null,
    };
  },
});
