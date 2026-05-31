import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const VALID_TYPES = new Set(["registration", "contribution"]);

const SQUAD_BASE_URL =
  process.env.SQUAD_ENV === "production"
    ? "https://api.squadco.com"
    : "https://sandbox-api-d.squadco.com";

export async function POST(request: NextRequest) {
  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    console.error("init-payment: SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

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

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.heritage-cooperative.com.ng";

  // Initiate the transaction on Squad's side. Squad returns the canonical
  // transaction_ref that both the widget and our verify endpoint will use.
  let transactionRef: string;
  try {
    const squadRes = await fetch(`${SQUAD_BASE_URL}/transaction/initiate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // naira → kobo
        email,
        currency_code: "NGN",
        initiate_type: "inline",
        CallBack_URL: `${baseUrl}/payment-callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!squadRes.ok) {
      const errorText = await squadRes.text().catch(() => "");
      console.error(`Squad initiate HTTP ${squadRes.status} (SQUAD_ENV=${process.env.SQUAD_ENV}, base=${SQUAD_BASE_URL}): ${errorText}`);
      return NextResponse.json(
        { error: "Could not initialise payment with gateway" },
        { status: 502 }
      );
    }

    const squadData = await squadRes.json();
    transactionRef = squadData?.data?.transaction_ref;
    if (!transactionRef || typeof transactionRef !== "string") {
      console.error("Squad initiate: missing transaction_ref in response", squadData);
      return NextResponse.json(
        { error: "Gateway did not return a transaction reference" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Squad initiate fetch error:", err);
    return NextResponse.json({ error: "Could not reach payment gateway" }, { status: 502 });
  }

  // Bind Squad's ref to payType and a 15-minute window so the verify endpoint
  // can reject replayed or cross-type submissions.
  const expiry = Date.now() + TOKEN_TTL_MS;
  const token = createHmac("sha256", hmacSecret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");

  return NextResponse.json({ transaction_ref: transactionRef, token, expiry });
}
