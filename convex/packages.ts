import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/adminAuth";

export const DEFAULT_PACKAGES = [
  { packageId: "bronze", name: "Bronze", desc: "Start small and build the savings habit.", daily: 500, loanMax: 100_000, regFee: 5_000, durationDays: 90, popular: false, order: 1 },
  { packageId: "silver", name: "Silver", desc: "Balanced plan for steady savers.", daily: 1_000, loanMax: 180_000, regFee: 10_000, durationDays: 90, popular: false, order: 2 },
  { packageId: "gold", name: "Gold", desc: "Double your momentum towards bigger goals.", daily: 2_000, loanMax: 360_000, regFee: 20_000, durationDays: 90, popular: true, order: 3 },
  { packageId: "diamond", name: "Diamond", desc: "High-capacity savings for ambitious targets.", daily: 5_000, loanMax: 1_000_000, regFee: 30_000, durationDays: 90, popular: false, order: 4 },
  { packageId: "emerald", name: "Emerald", desc: "Elite savings for maximum leverage.", daily: 10_000, loanMax: 2_000_000, regFee: 40_000, durationDays: 90, popular: false, order: 5 },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("packages").collect();
    return rows.sort((a, b) => a.order - b.order);
  },
});

export const getByIdInternal = internalQuery({
  args: { packageId: v.string() },
  handler: async (ctx, { packageId }) => {
    return await ctx.db
      .query("packages")
      .withIndex("byPackageId", (q) => q.eq("packageId", packageId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    packageId: v.string(),
    name: v.string(),
    desc: v.string(),
    daily: v.number(),
    loanMax: v.number(),
    regFee: v.number(),
    durationDays: v.number(),
    popular: v.optional(v.boolean()),
    order: v.number(),
    flexibleDaily: v.optional(v.boolean()),
    interestRatePercent: v.optional(v.number()),
    interestUnlockDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, ["content-admin"]);
    const existing = await ctx.db
      .query("packages")
      .withIndex("byPackageId", (q) => q.eq("packageId", args.packageId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("packages", args);
  },
});

export const remove = mutation({
  args: { packageId: v.string() },
  handler: async (ctx, { packageId }) => {
    await requireRole(ctx, ["content-admin"]);
    const existing = await ctx.db
      .query("packages")
      .withIndex("byPackageId", (q) => q.eq("packageId", packageId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["content-admin"]);
    const existing = await ctx.db.query("packages").first();
    if (existing) return;
    for (const pkg of DEFAULT_PACKAGES) {
      await ctx.db.insert("packages", pkg);
    }
  },
});
