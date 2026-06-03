import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import type { SquadWebhookBody } from "@/types/squad";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { limited, retryAfter } = rateLimit(ip);
  if (limited) {
    console.warn(`Squad webhook: rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    console.error("Squad webhook: SQUAD_SECRET_KEY not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Read raw body once — needed for both signature verification and JSON parsing.
  const rawBody = await request.text();

  const authHeader = request.headers.get("x-squad-encrypted-body") ?? "";
  if (authHeader) {
    const expected = createHmac("sha512", secretKey)
      .update(rawBody)
      .digest("hex")
      .toUpperCase();

    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(authHeader.toUpperCase(), "utf8");

    const signaturesMatch =
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf);

    if (!signaturesMatch) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: SquadWebhookBody;
  try {
    payload = JSON.parse(rawBody) as SquadWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.Event || !payload.TransactionRef || !payload.Body) {
    return NextResponse.json(
      { error: "Invalid webhook structure" },
      { status: 400 },
    );
  }

  if (payload.Event !== "charge_successful") {
    return NextResponse.json({ status: "ignored" });
  }

  try {
    const tx = payload.Body;
    const payType = payload.TransactionRef.startsWith("reg_") ? "registration" : "contribution";

    if (payType === "registration") {
      const registrationResult = await convex.action(
        api.registration.processRegistrationPayment,
        {
          webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
          email: tx.email,
          transactionRef: payload.TransactionRef,
          amount: Math.round(tx.amount / 100), // kobo → naira
        },
      );

      if (registrationResult.status === "ok") {
        if (!registrationResult.emailAlreadySent) {
          sendWelcomeEmail({
            email: tx.email,
            name: registrationResult.name,
            selectedPackage: registrationResult.selectedPackage,
            amount: Math.round(tx.amount / 100),
            transactionRef: payload.TransactionRef,
            paidAt: registrationResult.paidAt,
          })
            .then(() =>
              convex.mutation(api.registration.markWelcomeEmailSent, {
                webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
                userId: registrationResult.userId as never,
              }),
            )
            .catch((err) =>
              console.error("webhook sendWelcomeEmail failed:", err),
            );
        }
        return NextResponse.json({ status: "ok" });
      }

      if (registrationResult.status === "duplicate") {
        return NextResponse.json({ status: "ok" });
      }

      if (registrationResult.status === "unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (registrationResult.status === "insufficient_amount") {
        console.error(
          `Squad webhook: insufficient registration payment for email=${tx.email} ` +
            `ref=${payload.TransactionRef} amount=₦${Math.round(tx.amount / 100)}`,
        );
        return NextResponse.json(
          { error: "insufficient_amount" },
          { status: 402 },
        );
      }

      if (registrationResult.status === "not_found") {
        console.error(`Squad webhook: no user found for email=${tx.email} ref=${payload.TransactionRef}`);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ error: "Unexpected registration error" }, { status: 500 });
    }

    // contribution (payType === "contribution" or unknown/missing payType for backwards compat)
    const paymentInfo = tx.payment_information ?? {};
    const result = await convex.action(api.webhooks.processSquadPayment, {
      webhookSecret: process.env.CONVEX_WEBHOOK_SECRET!,
      transactionRef: payload.TransactionRef,
      email: tx.email,
      amount: tx.amount,
      merchantAmount: tx.merchant_amount ?? tx.amount,
      currency: tx.currency ?? "NGN",
      transactionStatus: tx.transaction_status ?? "unknown",
      transactionType: tx.transaction_type ?? "unknown",
      gatewayRef: tx.gateway_ref ?? undefined,
      paymentType: paymentInfo.payment_type ?? undefined,
      cardType: paymentInfo.card_type ?? undefined,
      pan: paymentInfo.pan ?? undefined,
      tokenId: paymentInfo.token_id ?? undefined,
      customerMobile: tx.customer_mobile ?? undefined,
      isRecurring: tx.is_recurring ?? undefined,
      meta: tx.metadata ?? tx.meta ?? undefined,
      merchantId: tx.merchant_id ?? undefined,
      squadCreatedAt: tx.created_at ?? new Date().toISOString(),
    });

    if (result.status === "user_not_found") {
      console.error(`Squad webhook: no user found for email ${tx.email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing Squad webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "webhook_endpoint_active",
    message: "Squad webhook endpoint is ready to receive notifications",
  });
}
