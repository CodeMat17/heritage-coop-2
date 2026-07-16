import { query } from "./_generated/server";

export const getHomepageStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const activeMembers = users.filter((u) => u.registrationPaid).length;

    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byStatus", (q) => q.eq("status", "success"))
      .collect();
    const totalSaved = contributions.reduce((sum, c) => sum + c.amount, 0);

    const loans = await ctx.db.query("userLoans").collect();
    const totalDisbursed = loans
      .filter((l) => l.status === "disbursed" || l.status === "cleared")
      .reduce((sum, l) => sum + l.amount, 0);

    const earliestCreation = users.reduce(
      (min, u) => Math.min(min, u._creationTime),
      Date.now()
    );
    const yearsActive = Math.max(
      1,
      Math.floor((Date.now() - earliestCreation) / (365 * 24 * 60 * 60 * 1000))
    );

    return { activeMembers, totalSaved, totalDisbursed, yearsActive };
  },
});
