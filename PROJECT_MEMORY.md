# Heritage Coop 2 — Project Memory

This file is the persistent reference for what this app is, how it works, and the rules
governing it. Read this before making assumptions about the domain or architecture.

## What this app is

Heritage Coop is a cooperative (thrift/esusu-style) society web app. Members:
1. Sign up and get onboarded (KYC-style profile capture).
2. Select a contribution package (bronze / silver / gold / diamond / emerald).
3. Pay a one-time registration fee tied to their package.
4. Make ongoing contributions (tracked per day/period).
5. Can apply for loans against a package.

## Tech stack

- **Next.js 16.2.4** (App Router) — this is *not* the Next.js you know from training data.
  Breaking changes exist; consult `node_modules/next/dist/docs/` before assuming API behavior.
- **Convex 1.36** — backend (database + serverless functions). Always read
  `convex/_generated/ai/guidelines.md` before writing/editing Convex code.
- **Clerk** (`@clerk/nextjs`) — authentication. Convex `users` table is keyed by Clerk's
  `externalId`; a webhook (`convex/webhooks.ts` → `users.upsertFromClerk`) keeps it in sync.
- **Squad** — Nigerian payment gateway, used for registration fees and contributions.
  Handled via `app/api/webhooks/squad/route.ts` and verify routes under `app/api/squad/`.
- **Resend + react-email** — transactional emails (e.g. welcome email after paid registration).
- **Tailwind v4 + radix-ui/shadcn + framer-motion** — UI layer.

## Domain model (`convex/schema.ts`)

- `users` — core identity, `isOnboarded`, `selectedPackage`, registration payment
  status/ref/amount, `isAdmin` flag. Indexed by `externalId`, `email`, `registrationRef`.
- `userData` — KYC/profile data: personal info, next-of-kin, banking details, and an
  **encrypted BVN** (see `convex/lib/bvnCrypto.ts`). One-to-one with `users` via `userId`.
- `userContributions` — recurring payments: `transactionRef`, `amount`, `coveredDates`,
  `status`. Indexed by `userId`, `transactionRef`, `status`.
- `userLoans` — loan applications tied to a `packageId`, with lifecycle timestamps
  (`appliedAt` → `approvedAt` → `disbursedAt` → `clearedAt`).

## Key business rules

- **Registration fee tiers** (`convex/registration.ts`): bronze ₦5,000 · silver ₦10,000 ·
  gold ₦20,000 · diamond ₦30,000 · emerald ₦40,000.
- **Idempotent payment processing** — `markRegistrationPaid` checks `registrationPaid` first
  and returns `"duplicate"` rather than double-processing. Underpayment is rejected with
  `"insufficient_amount"`.
- **Shared payment path** — both the client-side verify route and the Squad webhook route
  call the same `registration.processRegistrationPayment` action, gated by
  `CONVEX_WEBHOOK_SECRET`.
- **BVN handling** — BVN is encrypted (`lib/bvnCrypto`) before it ever reaches persisted
  storage. Encryption happens in an `action` (not a `mutation`), since IV generation needs
  non-deterministic randomness that Convex mutations disallow.
- **Registration refs** — human-readable IDs like `HC-2026-123456`, auto-generated on first
  Clerk sync (`upsertFromClerk`) or lazily via `ensureRegistrationRef`.

## App routes

`sign-in` / `sign-up` (Clerk) · `onboarding` · `select-package` · `payment-instructions` ·
`payment-callback` · `dashboard` (+ `dashboard/admin`) · API: `api/squad/init-payment`,
`api/squad/verify-registration/[ref]`, `api/squad/verify-contributions/[ref]`,
`api/webhooks/squad`.

## Where to look for more

- `convex/_generated/ai/guidelines.md` — Convex API rules and patterns (overrides training data).
- `node_modules/next/dist/docs/` — this project's actual Next.js API surface (overrides training data).
