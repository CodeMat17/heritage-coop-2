import { ConvexHttpClient } from "convex/browser";
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { SquadWebhookBody } from "@/types/squad";


const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Best-effort in-memory rate limiter (per serverless instance).
// Protects against flood/DoS; HMAC validation is the fraud guard.
const RATE_LIMIT = 30;        // max requests
const WINDOW_MS = 60_000;     // per 60 seconds

const ipWindows = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Purge entries older than two windows to prevent unbounded growth
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

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    console.warn(`Squad webhook: rate limit exceeded for IP ${ip}`);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const rawBody = await request.text();

    const signature = request.headers.get("x-squad-encrypted-body");
    if (!signature) {
      console.error("Squad webhook: missing x-squad-encrypted-body header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const secretKey = process.env.SQUAD_SECRET_KEY;
    if (!secretKey) {
      console.error("Squad webhook: SQUAD_SECRET_KEY not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    const signatureValid =
      sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

    if (!signatureValid) {
      console.error("Squad webhook: signature mismatch — request rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as SquadWebhookBody;

    if (!body.Event || !body.TransactionRef || !body.Body) {
      return NextResponse.json({ error: "Invalid webhook structure" }, { status: 400 });
    }

    if (body.Event !== "charge_successful") {
      return NextResponse.json({ status: "ignored" });
    }

    const tx = body.Body;
    const paymentInfo = tx.payment_information || {};

    const result = await convex.action(api.webhooks.processSquadPayment, {
      webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
      transactionRef: body.TransactionRef,
      email: tx.email,
      amount: tx.amount,
      merchantAmount: tx.merchant_amount ?? tx.amount,
      currency: tx.currency ?? "NGN",
      transactionStatus: tx.transaction_status ?? "unknown",
      transactionType: tx.transaction_type ?? "unknown",
      gatewayRef: tx.gateway_ref ?? undefined,
      paymentType: paymentInfo.payment_type ?? undefined,
      cardType: paymentInfo.card_type ?? undefined,
      pan: paymentInfo.pan ?? undefined,
      tokenId: paymentInfo.token_id ?? undefined,
      customerMobile: tx.customer_mobile ?? undefined,
      isRecurring: tx.is_recurring ?? undefined,
      meta: tx.metadata ?? tx.meta ?? undefined,
      merchantId: tx.merchant_id ?? undefined,
      squadCreatedAt: tx.created_at ?? new Date().toISOString(),
    });

    if (result.status === "user_not_found") {
      console.error(`Squad webhook: no user found for email ${tx.email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing Squad webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "webhook_endpoint_active",
    message: "Squad webhook endpoint is ready to receive notifications",
  });
}
