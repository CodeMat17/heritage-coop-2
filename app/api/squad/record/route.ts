import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";

// Called by the frontend immediately after Squad payment succeeds.
// All sensitive values (email, amount, status) come from Squad's API — never
// from the client. coveredDates are computed entirely server-side in Convex.
export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Only accept transactionRef from the client — nothing else is trusted.
  let body: { transactionRef: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { transactionRef } = body;
  if (!transactionRef || typeof transactionRef !== "string") {
    return NextResponse.json({ error: "Missing transactionRef" }, { status: 400 });
  }

  // Verify the transaction directly with Squad's API — amount, email, status
  // all come from here, not from the client.
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

  // Get Clerk JWT so Convex can authenticate and identify the caller.
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Could not obtain auth token" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  try {
    const result = await convex.action(api.webhooks.recordVerifiedPayment, {
      transactionRef,
      email: squadData.email as string,           // from Squad, not client
      amount: squadData.amount as number,          // from Squad, not client
      currency: (squadData.currency as string | undefined) ?? "NGN",
      transactionStatus: status,                   // from Squad, not client
      gatewayRef: (squadData.gateway_ref as string | undefined) ?? undefined,
      squadCreatedAt: (squadData.created_at as string | undefined) ?? new Date().toISOString(),
    });

    console.log("recordVerifiedPayment result:", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Convex record error:", err);
    return NextResponse.json({ error: "Failed to record contribution" }, { status: 500 });
  }
}
