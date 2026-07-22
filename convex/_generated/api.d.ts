/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminContributions from "../adminContributions.js";
import type * as content from "../content.js";
import type * as http from "../http.js";
import type * as interest from "../interest.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_bvnCrypto from "../lib/bvnCrypto.js";
import type * as lib_refGen from "../lib/refGen.js";
import type * as packages from "../packages.js";
import type * as registration from "../registration.js";
import type * as reports from "../reports.js";
import type * as stats from "../stats.js";
import type * as userContributions from "../userContributions.js";
import type * as userData from "../userData.js";
import type * as userLoans from "../userLoans.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminContributions: typeof adminContributions;
  content: typeof content;
  http: typeof http;
  interest: typeof interest;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/bvnCrypto": typeof lib_bvnCrypto;
  "lib/refGen": typeof lib_refGen;
  packages: typeof packages;
  registration: typeof registration;
  reports: typeof reports;
  stats: typeof stats;
  userContributions: typeof userContributions;
  userData: typeof userData;
  userLoans: typeof userLoans;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
