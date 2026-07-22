import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/adminAuth";
import { Id } from "./_generated/dataModel";

export const getFinancialSummary = query({
  args: { startDate: v.optional(v.string()), endDate: v.optional(v.string()) },
  handler: async (ctx, { startDate, endDate }) => {
    await requireRole(ctx, ["finance-admin", "finance-assist-admin"]);

    const startMs = startDate ? new Date(startDate + "T00:00:00").getTime() : undefined;
    const endMs = endDate ? new Date(endDate + "T23:59:59.999").getTime() : undefined;

    const inRange = (t: number) =>
      (startMs === undefined || t >= startMs) && (endMs === undefined || t <= endMs);

    const contributions = (await ctx.db.query("userContributions").collect()).filter((c) =>
      inRange(c._creationTime)
    );
    const loans = (await ctx.db.query("userLoans").collect()).filter((l) =>
      inRange(l.appliedAt)
    );
    const registrations = (await ctx.db.query("users").collect()).filter(
      (u) => u.registrationPaid && u.registrationPaidAt !== undefined && inRange(u.registrationPaidAt)
    );

    const successContributions = contributions.filter((c) => c.status === "success");
    const totalContributed = successContributions.reduce((s, c) => s + c.amount, 0);

    const userIds = new Set<string>();
    for (const c of successContributions) userIds.add(c.userId);
    for (const l of loans) userIds.add(l.userId);
    for (const u of registrations) userIds.add(u._id);
    const userNames = new Map<string, string>();
    await Promise.all(
      Array.from(userIds).map(async (id) => {
        const user = await ctx.db.get(id as Id<"users">);
        if (user) userNames.set(id, user.name);
      })
    );

    const loansByStatus = loans.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});
    const totalDisbursed = loans
      .filter((l) => l.status === "disbursed" || l.status === "cleared")
      .reduce((s, l) => s + l.amount, 0);

    const totalRegistrationFees = registrations.reduce(
      (s, u) => s + (u.registrationAmountPaid ?? 0),
      0
    );

    return {
      totalContributed,
      contributionCount: successContributions.length,
      loansByStatus,
      totalDisbursed,
      contributions: successContributions.map((c) => ({
        ...c,
        memberName: userNames.get(c.userId) ?? "Unknown",
      })),
      loans: loans.map((l) => ({
        ...l,
        memberName: userNames.get(l.userId) ?? "Unknown",
      })),
      totalRegistrationFees,
      registrationCount: registrations.length,
      registrations: registrations.map((u) => ({
        userId: u._id,
        memberName: userNames.get(u._id) ?? "Unknown",
        amount: u.registrationAmountPaid ?? 0,
        paymentMethod: u.registrationPaymentMethod,
        recordedBy: u.registrationRecordedBy,
        paidAt: u.registrationPaidAt,
      })),
    };
  },
});
