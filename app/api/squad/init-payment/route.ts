import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const VALID_TYPES = new Set(["registration", "contribution"]);

const SQUAD_INITIATE_URL =
  process.env.SQUAD_ENV === "production"
    ? "https://api.squadco.com/transactions/initiate"
    : "https://sandbox-api-d.squadco.com/transactions/initiate";

export async function POST(request: NextRequest) {
  const hmacSecret = process.env.PAYMENT_HMAC_SECRET;
  const secretKey = process.env.SQUAD_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;

  if (!hmacSecret || !secretKey || !publicKey) {
    console.error("init-payment: missing env vars (PAYMENT_HMAC_SECRET / SQUAD_SECRET_KEY / NEXT_PUBLIC_SQUAD_PUBLIC_KEY)");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let email: string;
  let amount: number;
  let payType: string;
  let callbackUrl: string;
  try {
    const body = await request.json();
    email = body?.email;
    amount = body?.amount;
    payType = body?.payType ?? "registration";
    callbackUrl = body?.callbackUrl ?? "";

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

  // Call Squad's initiate API to get a Squad-issued transaction_ref.
  // Squad's inline widget requires a ref that was registered with Squad —
  // it will 403 if we pass an arbitrary locally-generated ref.
  let transactionRef: string;
  try {
    const initiateRes = await fetch(SQUAD_INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100, // kobo
        email,
        key: publicKey,
        currency: "NGN",
        initiate_type: "inline",
        CallBack_URL: callbackUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!initiateRes.ok) {
      const errText = await initiateRes.text().catch(() => "");
      console.error(`Squad initiate HTTP ${initiateRes.status}: ${errText}`);
      return NextResponse.json(
        { error: "Could not initiate payment with gateway" },
        { status: 502 }
      );
    }

    const initiateData = await initiateRes.json();
    // Squad returns the ref at data.transaction_ref or data.checkout_url — extract ref
    transactionRef =
      initiateData?.data?.transaction_ref ??
      initiateData?.transaction_ref ??
      initiateData?.data?.checkout_url?.split("/").pop();

    if (!transactionRef) {
      console.error("Squad initiate: no transaction_ref in response", initiateData);
      return NextResponse.json(
        { error: "Gateway did not return a transaction reference" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Squad initiate fetch error:", err);
    return NextResponse.json({ error: "Could not reach payment gateway" }, { status: 502 });
  }

  const expiry = Date.now() + TOKEN_TTL_MS;
  const token = createHmac("sha256", hmacSecret)
    .update(`${transactionRef}:${payType}:${expiry}`)
    .digest("hex");

  return NextResponse.json({ transaction_ref: transactionRef, token, expiry });
}
