import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Called by the frontend after Squad payment succeeds, as a reliable fallback
// to webhooks. Verifies the transaction server-side then records the contribution.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: { transactionRef: string; coveredDates: string; daysCount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { transactionRef, coveredDates, daysCount } = body;
  if (!transactionRef || typeof transactionRef !== "string") {
    return NextResponse.json({ error: "Missing transactionRef" }, { status: 400 });
  }

  const baseUrl =
    secretKey.startsWith("test_sk") || secretKey.startsWith("sandbox_sk")
      ? "https://sandbox-api-d.squadco.com"
      : "https://api-d.squadco.com";

  let squadData: Record<string, unknown>;
  try {
    const res = await fetch(`${baseUrl}/transaction/verify/${transactionRef}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const json = await res.json();
    if (!res.ok || !json?.data) {
      console.error("Squad verify failed:", json);
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }
    squadData = json.data as Record<string, unknown>;
  } catch (err) {
    console.error("Squad verify request error:", err);
    return NextResponse.json({ error: "Could not reach payment provider" }, { status: 502 });
  }

  const status = (squadData.transaction_status as string | undefined) ?? "";
  if (status.toLowerCase() !== "success") {
    return NextResponse.json({ error: "Transaction not successful", status }, { status: 400 });
  }

  // Pass metadata through so processSquadPayment can parse coveredDates
  const meta = {
    coveredDates: coveredDates ?? (squadData.meta as Record<string, unknown> | undefined)?.coveredDates ?? "",
    daysCount: String(daysCount ?? 1),
  };

  try {
    const result = await convex.action(api.webhooks.processSquadPayment, {
      webhookSecret,
      transactionRef,
      email: squadData.email as string,
      amount: squadData.amount as number,
      merchantAmount: (squadData.merchant_amount as number | undefined) ?? (squadData.amount as number),
      currency: (squadData.currency as string | undefined) ?? "NGN",
      transactionStatus: status,
      transactionType: (squadData.transaction_type as string | undefined) ?? "unknown",
      gatewayRef: (squadData.gateway_ref as string | undefined) ?? undefined,
      paymentType: undefined,
      cardType: undefined,
      pan: undefined,
      tokenId: undefined,
      customerMobile: (squadData.customer_mobile as string | undefined) ?? undefined,
      isRecurring: undefined,
      meta,
      merchantId: (squadData.merchant_id as string | undefined) ?? undefined,
      squadCreatedAt: (squadData.created_at as string | undefined) ?? new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Convex record error:", err);
    return NextResponse.json({ error: "Failed to record contribution" }, { status: 500 });
  }
}
