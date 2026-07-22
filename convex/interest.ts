import { query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const getMyInterestStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.selectedPackage) return null;

    const pkg = await ctx.db
      .query("packages")
      .withIndex("byPackageId", (q) => q.eq("packageId", user.selectedPackage!))
      .unique();
    if (!pkg || !pkg.flexibleDaily || !pkg.interestRatePercent || !pkg.interestUnlockDays) {
      return null;
    }

    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "success"),
          q.eq(q.field("packageId"), pkg.packageId)
        )
      )
      .collect();

    if (contributions.length === 0) {
      return {
        principal: 0,
        daysSaved: 0,
        unlockDays: pkg.interestUnlockDays,
        unlocked: false,
        interestAmount: 0,
      };
    }

    let principal = 0;
    const coveredDates = new Set<string>();
    for (const c of contributions) {
      principal += c.amount;
      for (const d of c.coveredDates) {
        coveredDates.add(d);
      }
    }

    const daysSaved = coveredDates.size;
    const unlocked = daysSaved >= pkg.interestUnlockDays;
    const interestAmount = principal * (pkg.interestRatePercent / 100);

    return {
      principal,
      daysSaved,
      unlockDays: pkg.interestUnlockDays,
      unlocked,
      interestAmount,
    };
  },
});
