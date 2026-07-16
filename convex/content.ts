import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/adminAuth";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("content").collect();
    return Object.fromEntries(rows.map((r) => [r.key, r.data]));
  },
});

export const upsertSection = mutation({
  args: { key: v.string(), data: v.any() },
  handler: async (ctx, { key, data }) => {
    await requireRole(ctx, ["content-admin"]);
    const identity = await ctx.auth.getUserIdentity();
    const existing = await ctx.db
      .query("content")
      .withIndex("byKey", (q) => q.eq("key", key))
      .unique();
    const patch = { key, data, updatedAt: Date.now(), updatedBy: identity!.subject };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("content", patch);
  },
});
