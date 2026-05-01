"use client";

import { loadSquadScript, preloadSquadScript } from "@/hooks/useSquadScript";
import { verifySquadPayment } from "@/lib/verifySquadPayment";
import { SquadSuccessData, SquadVerifyResponse } from "@/types/squad";
/**
 * SquadPayButton — Heritage Cooperative
 *
 * Loads the Squad checkout widget on demand and opens it when the user clicks.
 * Follows the Squad Payment Modal API exactly as documented at:
 * https://docs.squadco.com/Payments/squad-payment-modal
 *
 * IMPORTANT — before this works you must:
 * 1. Add your domain to Squad dashboard → Settings → API Keys & Webhooks → Allowed Domains
 *    (add both "localhost:3000" for dev and "heritage-cooperative.com.ng" for production)
 * 2. Set NEXT_PUBLIC_SQUAD_PUBLIC_KEY in your .env.local
 * 3. Point your Squad webhook URL to: https://<your-domain>/api/webhooks/squad
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface SquadMetadata extends Record<string, unknown> {
  coveredDates?: string;
  daysCount?: string;
}

interface SquadPayButtonProps {
  email: string;
  phoneNumber?: string;
  amount: number;
  currencyCode?: "NGN";
  publicKey?: string;
  customerName?: string;
  transactionRef?: string;
  metadata?: SquadMetadata;
  children?: React.ReactNode;
  onSuccess?: (verification: SquadVerifyResponse) => void;
  onClose?: () => void;
  onVerifyError?: (err: Error) => void;
  label?: string;
  disabled?: boolean;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SquadPayButton({
  email,
  amount,
  phoneNumber,
  currencyCode = "NGN",
  publicKey,
  customerName,
  transactionRef,
  metadata,
  children,
  onSuccess,
  onClose,
  onVerifyError,
  label = "Pay Now",
  disabled = false,
}: SquadPayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { preloadSquadScript(); }, []);

  async function handlePayment() {
    if (!email || !isValidEmail(email)) {
      toast.error("A valid email address is required.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Payment amount is missing.");
      return;
    }
    if (!publicKey) {
      toast.error("Payment configuration is missing. Please refresh and try again.");
      return;
    }

    setBusy(true);
    try {
      await loadSquadScript();
    } catch {
      toast.error("Could not load payment widget. Check your connection and try again.");
      setBusy(false);
      return;
    }
    setBusy(false);

    const normalizedPhone = phoneNumber
      ? phoneNumber.startsWith("+")
        ? phoneNumber
        : "+234" + phoneNumber.replace(/^0/, "")
      : undefined;

    if (typeof window.squad === "undefined") {
      toast.error("Could not load payment widget. Check your connection and try again.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let squadInstance: any;
    try {
      squadInstance = new window.squad({
        key: publicKey,
        email,
        phone_number: normalizedPhone,
        amount: amount * 100,
        currency_code: currencyCode,
        customer_name: customerName,
        transaction_ref: transactionRef,
        metadata,
        onLoad: () => console.log("Squad modal ready"),
        onClose: () => {
          onClose?.();
        },
        onSuccess: async (data: SquadSuccessData) => {
          const ref = data.transaction_ref ?? transactionRef;
          if (!ref) {
            console.error("Squad: no transaction ref in onSuccess payload");
            return;
          }
          setVerifying(true);
          try {
            const verification = await verifySquadPayment(ref);
            if (verification.success && verification.data?.transaction_status?.toLowerCase() === "success") {
              toast.success("Payment successful! Your contribution has been recorded.");
              onSuccess?.(verification);
            } else {
              const err = new Error(`Payment verification failed: ${verification.message}`);
              onVerifyError?.(err);
              toast.error(err.message);
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error("Verification error");
            onVerifyError?.(error);
            toast.error(error.message);
            console.error("Verification error:", error.message);
          } finally {
            setVerifying(false);
          }
        },
      });
    } catch (err) {
      console.error("Squad init error:", err);
      toast.error("Could not open payment widget. Please refresh and try again.");
      return;
    }

    squadInstance.setup();
    squadInstance.open();
  }

  const isBusy = busy || verifying;

  return (
    <button
      onClick={handlePayment}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      className="w-full h-12 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isBusy ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          {verifying ? "Verifying…" : "Opening…"}
        </>
      ) : (
        children ?? label
      )}
    </button>
  );
}
