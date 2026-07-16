import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

interface InitiatePaymentBody {
  email: string;
  amount: number;
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

  const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
  if (!hmacSecret) {
    console.error("[init-payment] PAYMENT_HMAC_SECRET not configured");
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  const body: InitiatePaymentBody = await request.json();
  const { email, amount, payType = "registration" } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: "Invalid email address." }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount < 10000) {
    return NextResponse.json(
      { success: false, message: "Amount must be at least ₦100 (10000 kobo)." },
      { status: 400 }
    );
  }

  // The Squad inline widget creates and initiates the transaction itself
  // (using the public key, client-side) once it opens with this ref — we
  // must not pre-register the same ref via Squad's server-side
  // /transaction/initiate first, or Squad's own widget hangs trying to
  // initiate a ref that already exists.
  const prefix = payType === "contribution" ? "con" : "reg";
  const transactionRef = `${prefix}_${randomBytes(16).toString("hex")}`;
  const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes
  const token = createHmac("sha256", hmacSecret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");

  return NextResponse.json({
    success: true,
    data: { transaction_ref: transactionRef, _verifyToken: token, _verifyExpiry: expiry },
  });
}
