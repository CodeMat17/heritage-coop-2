import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { SquadVerifyResponse } from "@/types/squad";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SQUAD_BASE_URL =
  process.env.SQUAD_ENV === "production"
    ? "https://api-d.squadco.com"
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
    console.error("verify-registration: SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let transactionRef: string;
  try {
    const body = await request.json();
    transactionRef = body?.transactionRef;
    if (!transactionRef || typeof transactionRef !== "string") {
      return NextResponse.json({ error: "transactionRef is required" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(transactionRef)) {
      return NextResponse.json({ error: "Invalid transactionRef format" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
    console.error("Squad verify fetch error:", err);
    return NextResponse.json({ error: "Could not reach payment gateway" }, { status: 502 });
  }

  if (!squadData.success || squadData.data?.transaction_status?.toLowerCase() !== "success") {
    console.warn(
      `Squad verify: non-success status for ref=${transactionRef}`,
      squadData.data?.transaction_status
    );
    return NextResponse.json({ error: "Payment not confirmed by gateway" }, { status: 402 });
  }

  const { email, transaction_amount: amount } = squadData.data;

  if (!email || typeof amount !== "number") {
    console.error("Squad verify: missing email or amount in response", squadData.data);
    return NextResponse.json({ error: "Incomplete payment data from gateway" }, { status: 502 });
  }

  const result = await convex.action(api.registration.processRegistrationPayment, {
    webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
    email,
    transactionRef,
    amount,
  });

  if (result.status === "ok" || result.status === "duplicate") {
    return NextResponse.json({ status: "ok" });
  }

  if (result.status === "insufficient_amount") {
    console.error(`verify-registration: insufficient amount email=${email} paid=${amount}`);
    return NextResponse.json(
      { error: "Amount paid is less than the required registration fee." },
      { status: 402 }
    );
  }

  if (result.status === "not_found") {
    console.error(`verify-registration: no user found for email=${email}`);
    return NextResponse.json({ error: "Account not found for this payment." }, { status: 404 });
  }

  return NextResponse.json({ error: "Unexpected error during registration." }, { status: 500 });
}
