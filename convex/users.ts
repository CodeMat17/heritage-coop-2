import { action, internalMutation, mutation, query, QueryCtx } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";
import { internal } from "./_generated/api";
import { encryptBvn } from "./lib/bvnCrypto";
import { generateRegistrationRef } from "./lib/refGen";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const currentWithData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const userData = await ctx.db
      .query("userData")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .unique();
    return { ...user, userData };
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  async handler(ctx, { data }) {
    const email = data.email_addresses?.[0]?.email_address ?? "";
    const userAttributes = {
      name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
      email,
      externalId: data.id,
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      const registrationRef = generateRegistrationRef();
      await ctx.db.insert("users", { ...userAttributes, isOnboarded: false, registrationRef });
    } else {
      await ctx.db.patch(user._id, {
        name: userAttributes.name,
        email: userAttributes.email,
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const user = await userByExternalId(ctx, clerkUserId);
    if (user !== null) {
      const userData = await ctx.db
        .query("userData")
        .withIndex("byUserId", (q) => q.eq("userId", user._id))
        .unique();
      if (userData) await ctx.db.delete(userData._id);
      await ctx.db.delete(user._id);
    } else {
      console.warn(`Can't delete user, none found for Clerk ID: ${clerkUserId}`);
    }
  },
});

const userDataFields = {
  fullName: v.string(),
  gender: v.string(),
  nickName: v.string(),
  motherMaidenName: v.string(),
  dateOfBirth: v.string(),
  placeOfBirth: v.string(),
  nationality: v.string(),
  stateOfOrigin: v.string(),
  lga: v.string(),
  homeTown: v.string(),
  maritalStatus: v.string(),
  mobilePhoneNumber: v.string(),
  otherPhoneNumber: v.optional(v.string()),
  residentialAddress: v.string(),
  permanentAddress: v.string(),
  taxIdentificationNumber: v.optional(v.string()),
  typeOfTrade: v.string(),
  yearsInTrade: v.number(),
  otherTradeOrSkill: v.optional(v.string()),
  meansOfIdentification: v.string(),
  meansOfIdentificationStartDate: v.string(),
  meansOfIdentificationExpiryDate: v.string(),
  educationalBackground: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  bankName: v.string(),
  // bvn is stored encrypted; the action encrypts it before calling the mutation
  bvn: v.string(),
  nokSurname: v.string(),
  nokFirstName: v.string(),
  nokOtherName: v.string(),
  nokTitle: v.string(),
  nokDateOfBirth: v.string(),
  nokGender: v.string(),
  nokRelationship: v.string(),
  nokPhoneNumber: v.string(),
  nokEmail: v.string(),
  nokHouseAddress: v.string(),
};

// Internal mutation — receives the BVN already encrypted.
// Resolves the target user either by an explicit userId (admin/walk-in path)
// or by externalId (self-service Clerk path, creating the row if missing).
export const upsertUserDataInternal = internalMutation({
  args: {
    externalId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    identityEmail: v.optional(v.string()),
    ...userDataFields,
  },
  async handler(ctx, args) {
    const { externalId, userId, identityEmail, ...data } = args;
    const email = identityEmail ?? "";

    let user = userId ? await ctx.db.get(userId) : null;
    if (!user && externalId) user = await userByExternalId(ctx, externalId);
    if (!user) {
      if (!externalId) throw new Error("User not found and no externalId to create one");
      const newUserId = await ctx.db.insert("users", {
        externalId,
        name: data.fullName,
        email,
        isOnboarded: false,
      });
      user = await ctx.db.get(newUserId);
    }
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      isOnboarded: true,
      name: data.fullName,
      ...(email && !user.email ? { email } : {}),
    });

    const existing = await ctx.db
      .query("userData")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .unique();

    const payload = { userId: user._id, ...data };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("userData", payload);
    }
  },
});

// Public action — encrypts the BVN before persisting, then delegates to the
// internal mutation. Actions allow non-deterministic ops (random IV generation).
export const upsertUserData = action({
  args: userDataFields,
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const encKey = process.env.BVN_ENCRYPTION_KEY;
    if (!encKey) throw new Error("BVN_ENCRYPTION_KEY is not configured");

    const encryptedBvn = await encryptBvn(args.bvn, encKey);

    await ctx.runMutation(internal.users.upsertUserDataInternal, {
      externalId: identity.subject,
      identityEmail: identity.email ?? "",
      ...args,
      bvn: encryptedBvn,
    });
  },
});

export const ensureRegistrationRef = mutation({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await userByExternalId(ctx, identity.subject);
    if (!user) throw new Error("User not found");
    if (!user.registrationRef) {
      await ctx.db.patch(user._id, { registrationRef: generateRegistrationRef() });
    }
  },
});

export const selectPackage = mutation({
  args: { packageId: v.string() },
  async handler(ctx, { packageId }) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    let user = await userByExternalId(ctx, identity.subject);
    if (!user) {
      const userId = await ctx.db.insert("users", {
        externalId: identity.subject,
        name: identity.name ?? "",
        email: identity.email ?? "",
        isOnboarded: false,
      });
      user = await ctx.db.get(userId);
    }
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      selectedPackage: packageId,
      packageSelectedAt: Date.now(),
    });
  },
});

export async function getCurrentUserOrThrow(ctx: QueryCtx) {
  const userRecord = await getCurrentUser(ctx);
  if (!userRecord) throw new Error("Can't get current user");
  return userRecord;
}

export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await userByExternalId(ctx, identity.subject);
}

export async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", externalId))
    .unique();
}
