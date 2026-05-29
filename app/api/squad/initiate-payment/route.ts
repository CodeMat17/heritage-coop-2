import { NextRequest, NextResponse } from "next/server";

const SQUAD_INITIATE_URL =
  process.env.SQUAD_ENV === "production"
    ? "https://api-d.squadco.com/transaction/initiate"
    : "https://sandbox-api-d.squadco.com/transaction/initiate";

const SQUAD_HEADERS = (secretKey: string) => ({
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "HeritageCoop/1.0",
});

export async function POST(request: NextRequest) {
  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    console.error("initiate-payment: SQUAD_SECRET_KEY not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let email: string;
  let amount: number;

  try {
    const body = await request.json();
    email = body?.email;
    amount = body?.amount;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transactionRef = `HC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  try {
    const res = await fetch(SQUAD_INITIATE_URL, {
      method: "POST",
      headers: SQUAD_HEADERS(secretKey),
      body: JSON.stringify({
        email,
        amount,
        currency: "NGN",
        initiate_type: "inline",
        transaction_ref: transactionRef,
        pass_charge: true,
        ...(process.env.NEXT_PUBLIC_BASE_URL
          ? { callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-callback` }
          : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();

    if (!res.ok || !data?.data?.checkout_url) {
      console.error("Squad initiate failed:", data);
      return NextResponse.json(
        { error: data?.message ?? "Failed to initiate payment" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      checkout_url: data.data.checkout_url,
      transaction_ref: transactionRef,
    });
  } catch (err) {
    console.error("Squad initiate fetch error:", err);
    return NextResponse.json({ error: "Could not reach payment gateway" }, { status: 502 });
  }
}
