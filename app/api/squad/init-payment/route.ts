import { createHmac, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const VALID_TYPES = new Set(["registration", "contribution"]);

export async function POST(request: NextRequest) {
  const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
  if (!hmacSecret) {
    console.error("init-payment: PAYMENT_HMAC_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let email: string;
  let amount: number;
  let payType: string;
  try {
    const body = await request.json();
    email = body?.email;
    amount = body?.amount;
    payType = body?.payType ?? "registration";

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }
    if (!VALID_TYPES.has(payType)) {
      return NextResponse.json({ error: "Invalid payType" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Generate a unique ref that Squad will honour when passed to the inline widget.
  // Format: HC-<timestamp>-<12 hex chars> — stays within Squad's 50-char limit.
  const transactionRef = `HC-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

  const expiry = Date.now() + TOKEN_TTL_MS;
  const token = createHmac("sha256", hmacSecret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");

  return NextResponse.json({ transaction_ref: transactionRef, token, expiry });
}
