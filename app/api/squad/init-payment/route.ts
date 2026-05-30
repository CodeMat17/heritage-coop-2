import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VALID_TYPES = new Set(["registration", "contribution"]);

export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_HMAC_SECRET;
  if (!secret) {
    console.error("init-payment: PAYMENT_HMAC_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let transactionRef: string;
  let payType: string;
  try {
    const body = await request.json();
    transactionRef = body?.transactionRef;
    payType = body?.payType ?? "registration";
    if (!transactionRef || typeof transactionRef !== "string") {
      return NextResponse.json({ error: "transactionRef is required" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(transactionRef)) {
      return NextResponse.json({ error: "Invalid transactionRef format" }, { status: 400 });
    }
    if (!VALID_TYPES.has(payType)) {
      return NextResponse.json({ error: "Invalid payType" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const expiry = Date.now() + TOKEN_TTL_MS;
  // payType is bound into the HMAC so a token issued for "registration" is
  // cryptographically rejected by the "contribution" verify endpoint and vice versa.
  const token = createHmac("sha256", secret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");

  return NextResponse.json({ token, expiry });
}
