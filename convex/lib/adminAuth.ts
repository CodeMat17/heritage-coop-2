import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

// Keep in sync with ADMIN_ROLES in proxy.ts — Convex functions can't import
// from the app/ directory, so this list is intentionally duplicated there.
export type AdminRole = "content-admin" | "finance-admin" | "assist-admin" | "super-admin";

type AuthedCtx = QueryCtx | MutationCtx | ActionCtx;

async function getRole(ctx: AuthedCtx): Promise<string | undefined> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return (identity as Record<string, unknown>).role as string | undefined;
}

// Throws unless the caller's role is one of `allowed`, or "super-admin" (which
// always passes every role check).
export async function requireRole(ctx: AuthedCtx, allowed: AdminRole[]) {
  const role = await getRole(ctx);
  if (role === "super-admin") return;
  if (!role || !allowed.includes(role as AdminRole)) throw new Error("Forbidden");
}

// Passes for any of the four admin roles — used by shared views (member list/
// detail) that every admin tab needs regardless of their specific role.
export async function requireAnyAdmin(ctx: AuthedCtx) {
  const role = await getRole(ctx);
  const allRoles: AdminRole[] = ["content-admin", "finance-admin", "assist-admin", "super-admin"];
  if (!role || !allRoles.includes(role as AdminRole)) throw new Error("Forbidden");
}

// Human-readable label for audit trails ("recordedBy"). Prefers the admin's
// Clerk name; falls back to the local part of their email (e.g. "matthew" from
// "matthew@gmail.com" or "info" from "info@matthew.com"); falls back to the
// Clerk subject id if neither is available.
export function getRecordedByName(identity: { name?: string; email?: string; subject: string } | null): string | undefined {
  if (!identity) return undefined;
  if (identity.name) return identity.name;
  if (identity.email) return identity.email.split("@")[0];
  return identity.subject;
}
