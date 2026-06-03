import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { SquadVerifyResponse } from "@/types/squad";
import { rateLimit } from "@/lib/rateLimit";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { limited, retryAfter } = rateLimit(ip);
  if (limited) {
    return NextResponse.json(
      { success: false, message: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    console.error("[verify-contributions] SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
  if (!hmacSecret) {
    console.error("[verify-contributions] PAYMENT_HMAC_SECRET not configured");
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  const { ref: transactionRef } = await params;

  if (!/^[\w\-.]{4,200}$/.test(transactionRef)) {
    return NextResponse.json({ success: false, message: "Invalid transactionRef format." }, { status: 400 });
  }

  let clientToken: string;
  let expiry: number;
  try {
    const body = await request.json();
    clientToken = body?.token;
    expiry = body?.expiry;
    if (!clientToken || typeof clientToken !== "string") {
      return NextResponse.json({ success: false, message: "Payment token is required." }, { status: 400 });
    }
    if (!expiry || typeof expiry !== "number") {
      return NextResponse.json({ success: false, message: "Token expiry is required." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  if (!verifyHmacToken(hmacSecret, transactionRef, "contribution", expiry, clientToken)) {
    console.warn(`[verify-contributions] invalid/expired token for ref=${transactionRef}`);
    return NextResponse.json({ success: false, message: "Invalid or expired payment token." }, { status: 403 });
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

    const text = await res.text();
    if (!res.ok) {
      console.error("[verify-contributions] Squad non-OK status:", res.status);
      return NextResponse.json(
        { success: false, message: "Payment verification failed. Please contact support if payment was deducted." },
        { status: 502 }
      );
    }

    try {
      squadData = JSON.parse(text) as SquadVerifyResponse;
    } catch {
      return NextResponse.json(
        { success: false, message: `Squad API returned non-JSON: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[verify-contributions] Network error:", err);
    return NextResponse.json(
      { success: false, message: `Network error reaching Squad API: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (!squadData.success || squadData.data?.transaction_status?.toLowerCase() !== "success") {
    console.warn(
      `[verify-contributions] non-success status for ref=${transactionRef}`,
      squadData.data?.transaction_status
    );
    return NextResponse.json({ success: false, message: "Payment not confirmed by gateway." }, { status: 402 });
  }

  const { email, transaction_amount: amountKobo, gateway_ref, currency, meta } = squadData.data;

  if (!email || typeof amountKobo !== "number") {
    console.error("[verify-contributions] missing email or amount in response", squadData.data);
    return NextResponse.json({ success: false, message: "Incomplete payment data from gateway." }, { status: 502 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("[verify-contributions] invalid email in response", email);
    return NextResponse.json({ success: false, message: "Invalid email address." }, { status: 400 });
  }

  if (!Number.isInteger(amountKobo) || amountKobo < 10000) {
    console.error(`[verify-contributions] amount too low for ref=${transactionRef} amount=${amountKobo}`);
    return NextResponse.json(
      { success: false, message: "Amount must be at least ₦100 (10000 kobo)." },
      { status: 400 }
    );
  }

  const result = await convex.action(api.webhooks.processSquadPayment, {
    webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
    transactionRef,
    email,
    amount: amountKobo,
    merchantAmount: squadData.data.merchant_amount ?? amountKobo,
    currency: currency ?? "NGN",
    transactionStatus: squadData.data.transaction_status,
    gatewayRef: gateway_ref ?? undefined,
    meta: meta ?? undefined,
  });

  if (result.status === "ok") {
    return NextResponse.json({ success: true, status: "ok" });
  }

  if (result.status === "duplicate") {
    return NextResponse.json({ success: true, status: "ok" });
  }

  if (result.status === "user_not_found") {
    console.error(`[verify-contributions] no user found for email=${email}`);
    return NextResponse.json({ success: false, message: "Account not found for this payment." }, { status: 404 });
  }

  if (result.status === "unknown_package") {
    console.error(`[verify-contributions] unknown package for email=${email}`);
    return NextResponse.json({ success: false, message: "Your account package is not configured." }, { status: 400 });
  }

  return NextResponse.json({ success: false, message: "Unexpected error recording contribution." }, { status: 500 });
}
