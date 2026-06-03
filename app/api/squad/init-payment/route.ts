import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

interface InitiatePaymentBody {
  email: string;
  amount: number;
  currency?: string;
  transaction_ref?: string;
  payType?: "registration" | "contribution";
}

export async function POST(request: NextRequest) {
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

  const body: InitiatePaymentBody = await request.json();
  const { email, amount, currency = "NGN", transaction_ref, payType = "registration" } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: "Invalid email address." }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount < 10000) {
    return NextResponse.json(
      { success: false, message: "Amount must be at least ₦100 (10000 kobo)." },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {
    email,
    amount,
    currency,
    initiate_type: "inline",
    callback_url: process.env.SQUAD_WEBHOOK_URL,
  };

  const prefix = payType === "contribution" ? "con" : "reg";
  const ref = transaction_ref ?? `${prefix}_${randomBytes(16).toString("hex")}`;
  payload.transaction_ref = ref;

  let response: Response;
  try {
    const squadBase =
      process.env.NODE_ENV === "production"
        ? "https://api-d.squadco.com"
        : "https://sandbox-api-d.squadco.com";
    response = await fetch(`${squadBase}/transaction/initiate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[Squad initiate] Network error:", err);
    return NextResponse.json(
      { success: false, message: `Network error reaching Squad API: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const text = await response.text();
  if (!response.ok) {
    console.error("[Squad initiate] Non-OK response status:", response.status);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { success: false, message: `Squad API returned non-JSON: ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  // If Squad returned success, attach a short-lived HMAC token so the client
  // can call /api/squad/verify-registration/[ref] or /api/squad/verify-contributions/[ref]
  // without being able to forge the ref. payType is bound into the signature.
  const squadData = data as { success?: boolean; data?: { transaction_ref?: string } };
  if (squadData?.success && squadData?.data?.transaction_ref) {
    const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
    if (hmacSecret) {
      const ref = squadData.data.transaction_ref;
      const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes
      const token = createHmac("sha256", hmacSecret)
        .update(`${ref}:${payType}:${expiry}`)
        .digest("hex");
      return NextResponse.json(
        { ...squadData, data: { ...squadData.data, _verifyToken: token, _verifyExpiry: expiry, token, expiry } },
        { status: response.status }
      );
    }
  }

  return NextResponse.json(data, { status: response.status });
}
