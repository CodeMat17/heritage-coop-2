import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { SquadVerifyResponse } from "@/types/squad";
import { sendWelcomeEmail } from "@/lib/email";
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
    console.error("[verify-registration] SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  const { ref: transactionRef } = await params;

  if (!/^[\w\-.]{4,200}$/.test(transactionRef)) {
    return NextResponse.json({ success: false, message: "Invalid transactionRef format." }, { status: 400 });
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
      console.error("[verify-registration] Squad non-OK status:", res.status);
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
    console.error("[verify-registration] Network error:", err);
    return NextResponse.json(
      { success: false, message: `Network error reaching Squad API: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (!squadData.success || squadData.data?.transaction_status?.toLowerCase() !== "success") {
    console.warn(
      `[verify-registration] non-success status for ref=${transactionRef}`,
      squadData.data?.transaction_status
    );
    return NextResponse.json({ success: false, message: "Payment not confirmed by gateway." }, { status: 402 });
  }

  const { email, transaction_amount: amountKobo } = squadData.data;

  if (!email || typeof amountKobo !== "number") {
    console.error("[verify-registration] missing email or amount in response", squadData.data);
    return NextResponse.json({ success: false, message: "Incomplete payment data from gateway." }, { status: 502 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("[verify-registration] invalid email in response", email);
    return NextResponse.json({ success: false, message: "Invalid email address." }, { status: 400 });
  }

  if (!Number.isInteger(amountKobo) || amountKobo < 10000) {
    console.error(`[verify-registration] amount too low for ref=${transactionRef} amount=${amountKobo}`);
    return NextResponse.json(
      { success: false, message: "Amount must be at least ₦100 (10000 kobo)." },
      { status: 400 }
    );
  }

  const amount = Math.round(amountKobo / 100);

  const result = await convex.action(api.registration.processRegistrationPayment, {
    webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
    email,
    transactionRef,
    amount,
  });

  if (result.status === "ok") {
    if (!result.emailAlreadySent) {
      sendWelcomeEmail({ email, name: result.name, selectedPackage: result.selectedPackage, amount, transactionRef, paidAt: result.paidAt })
        .then(() =>
          convex.mutation(api.registration.markWelcomeEmailSent, {
            webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
            userId: result.userId as never,
          })
        )
        .catch((err) => console.error("[verify-registration] sendWelcomeEmail failed:", err));
    }
    return NextResponse.json({ success: true, status: "ok" });
  }

  if (result.status === "duplicate") {
    return NextResponse.json({ success: true, status: "ok" });
  }

  if (result.status === "insufficient_amount") {
    console.error(`[verify-registration] insufficient amount email=${email} paid=₦${amount}`);
    return NextResponse.json(
      { success: false, message: "Amount paid is less than the required registration fee." },
      { status: 402 }
    );
  }

  if (result.status === "not_found") {
    console.error(`[verify-registration] no user found for email=${email}`);
    return NextResponse.json({ success: false, message: "Account not found for this payment." }, { status: 404 });
  }

  return NextResponse.json({ success: false, message: "Unexpected error during registration." }, { status: 500 });
}
