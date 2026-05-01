import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

export const getTotalSaved = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byStatus", (q) => q.eq("status", "success"))
      .collect();
    return contributions.reduce((sum, c) => sum + c.amount, 0);
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db.query("users").collect();
  },
});

export const getUserDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const userData = await ctx.db
      .query("userData")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .unique();
    const contributions = await ctx.db
      .query("userContributions")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const loans = await ctx.db
      .query("userLoans")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return { user, userData, contributions, loans };
  },
});

export const clearLoan = mutation({
  args: { loanId: v.id("userLoans") },
  handler: async (ctx, { loanId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.patch(loanId, { status: "cleared", clearedAt: Date.now() });
  },
});

export const approveLoan = mutation({
  args: { loanId: v.id("userLoans") },
  handler: async (ctx, { loanId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.patch(loanId, { status: "approved", approvedAt: Date.now() });
  },
});

export const disburseLoan = mutation({
  args: { loanId: v.id("userLoans") },
  handler: async (ctx, { loanId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    await ctx.db.patch(loanId, { status: "disbursed", disbursedAt: Date.now() });
  },
});
