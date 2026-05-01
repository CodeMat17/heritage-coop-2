import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    name: v.string(),
    email: v.string(),
    isOnboarded: v.optional(v.boolean()),
    selectedPackage: v.optional(v.string()),
    packageSelectedAt: v.optional(v.number()),
  }).index("byExternalId", ["externalId"]).index("byEmail", ["email"]),

  userData: defineTable({
    userId: v.id("users"),
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
    // Banking
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    bvn: v.string(),
    // Next of kin
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
  }).index("byUserId", ["userId"]),

  userContributions: defineTable({
    userId: v.id("users"),
    transactionRef: v.string(),
    amount: v.number(),
    daysCount: v.number(),
    coveredDates: v.array(v.string()),
    status: v.string(),
    squadCreatedAt: v.optional(v.string()),
    gatewayRef: v.optional(v.string()),
    currency: v.optional(v.string()),
  })
    .index("byUserId", ["userId"])
    .index("byTransactionRef", ["transactionRef"])
    .index("byStatus", ["status"]),

  userLoans: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    packageId: v.string(),
    status: v.string(),
    appliedAt: v.number(),
    approvedAt: v.optional(v.number()),
    disbursedAt: v.optional(v.number()),
    clearedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("byUserId", ["userId"]),
});
