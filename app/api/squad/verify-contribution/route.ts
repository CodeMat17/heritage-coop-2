import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { SquadVerifyResponse } from "@/types/squad";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SQUAD_BASE_URL =
  process.env.SQUAD_ENV === "production"
    ? "https://api.squadco.com"
    : "https://sandbox-api-d.squadco.com";

const SQUAD_HEADERS = (secretKey: string) => ({
  Authorization: `Bearer ${secretKey}`,
  Accept: "application/json",
  "User-Agent": "HeritageCoop/1.0",
});

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const ipWindows = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, entry] of ipWindows) {
    if (now - entry.windowStart > WINDOW_MS * 2) ipWindows.delete(key);
  }
  const entry = ipWindows.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipWindows.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// payType is bound into the HMAC so a token issued for "registration" is
// rejected here and vice versa, preventing cross-type token misuse.
function verifyHmacToken(
  secret: string,
  transactionRef: string,
  payType: string,
  expiry: number,
  clientToken: string
): boolean {
  if (Date.now() > expiry) return false;
  const expected = createHmac("sha256", secret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");
  const expBuf = Buffer.from(expected, "hex");
  const cliBuf = Buffer.from(
    clientToken.length === expected.length ? clientToken : expected,
    "hex"
  );
  return timingSafeEqual(expBuf, cliBuf) && clientToken === expected;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    console.error("verify-contribution: SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
  if (!hmacSecret) {
    console.error("verify-contribution: PAYMENT_HMAC_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let transactionRef: string;
  let clientToken: string;
  let expiry: number;
  try {
    const body = await request.json();
    transactionRef = body?.transactionRef;
    clientToken = body?.token;
    expiry = body?.expiry;
    if (!transactionRef || typeof transactionRef !== "string") {
      return NextResponse.json({ error: "transactionRef is required" }, { status: 400 });
    }
    if (!/^[\w\-.]{4,200}$/.test(transactionRef)) {
      return NextResponse.json({ error: "Invalid transactionRef format" }, { status: 400 });
    }
    if (!clientToken || typeof clientToken !== "string") {
      return NextResponse.json({ error: "Payment token is required" }, { status: 400 });
    }
    if (!expiry || typeof expiry !== "number") {
      return NextResponse.json({ error: "Token expiry is required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!verifyHmacToken(hmacSecret, transactionRef, "contribution", expiry, clientToken)) {
    console.warn(`verify-contribution: invalid/expired token for ref=${transactionRef}`);
    return NextResponse.json({ error: "Invalid or expired payment token." }, { status: 403 });
  }

  let squadData: SquadVerifyResponse;
  try {
    const res = await fetch(
      `${SQUAD_BASE_URL}/transaction/verify/${encodeURIComponent(transactionRef)}`,
      {
        headers: SQUAD_HEADERS(secretKey),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`Squad verify HTTP ${res.status} for ref=${transactionRef}: ${errorText}`);
      return NextResponse.json(
        { error: "Payment verification failed. Please contact support if payment was deducted." },
        { status: 502 }
      );
    }

    squadData = (await res.json()) as SquadVerifyResponse;
  } catch (err) {
    console.error("Squad verify-contribution fetch error:", err);
    return NextResponse.json({ error: "Could not reach payment gateway" }, { status: 502 });
  }

  if (!squadData.success || squadData.data?.transaction_status?.toLowerCase() !== "success") {
    console.warn(
      `Squad verify-contribution: non-success status for ref=${transactionRef}`,
      squadData.data?.transaction_status
    );
    return NextResponse.json({ error: "Payment not confirmed by gateway" }, { status: 402 });
  }

  const { email, transaction_amount: amountKobo } = squadData.data;

  if (!email || typeof amountKobo !== "number") {
    console.error("Squad verify-contribution: missing email or amount in response", squadData.data);
    return NextResponse.json({ error: "Incomplete payment data from gateway" }, { status: 502 });
  }

  const result = await convex.action(api.webhooks.processSquadPayment, {
    webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
    transactionRef,
    email,
    amount: amountKobo, // processSquadPayment divides by 100 internally
    transactionStatus: "success",
    currency: squadData.data.currency ?? "NGN",
    gatewayRef: squadData.data.gateway_ref ?? undefined,
  });

  if (result.status === "ok") {
    return NextResponse.json({ status: "ok" });
  }

  if (result.status === "duplicate") {
    return NextResponse.json({ status: "ok" });
  }

  if (result.status === "user_not_found") {
    console.error(`verify-contribution: no user found for email=${email}`);
    return NextResponse.json({ error: "Account not found for this payment." }, { status: 404 });
  }

  if (result.status === "unknown_package") {
    console.error(`verify-contribution: unknown package for email=${email}`);
    return NextResponse.json({ error: "Account package is not configured." }, { status: 422 });
  }

  if (result.status === "ignored") {
    return NextResponse.json({ error: "Payment not confirmed by gateway" }, { status: 402 });
  }

  console.error(`verify-contribution: unexpected status=${result.status} for ref=${transactionRef}`);
  return NextResponse.json({ error: "Unexpected error during contribution." }, { status: 500 });
}
