import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

export const getMyLoans = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("userLoans")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const applyForLoan = mutation({
  args: { amount: v.number(), packageId: v.string() },
  handler: async (ctx, { amount, packageId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (user.selectedPackage !== packageId) {
      throw new Error("Package mismatch");
    }

    const pkg = await ctx.db
      .query("packages")
      .withIndex("byPackageId", (q) => q.eq("packageId", packageId))
      .unique();
    if (!pkg) throw new Error(`Unknown package "${packageId}"`);
    if (amount > pkg.loanMax) {
      throw new Error(`Amount exceeds the loan cap for your package (₦${pkg.loanMax.toLocaleString("en-NG")})`);
    }

    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "success"))
      .collect();
    const daysContributed = new Set(contributions.flatMap((c) => c.coveredDates)).size;
    if (daysContributed < pkg.durationDays) {
      throw new Error(`You must complete ${pkg.durationDays} days of contributions before applying for a loan`);
    }

    const existing = await ctx.db
      .query("userLoans")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "disbursed")
        )
      )
      .first();

    if (existing) throw new Error("You already have an active loan");

    return await ctx.db.insert("userLoans", {
      userId: user._id,
      amount,
      packageId,
      status: "pending",
      appliedAt: Date.now(),
    });
  },
});
