"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SQUAD_SCRIPT_URL =
  process.env.NEXT_PUBLIC_SQUAD_ENV === "production"
    ? "https://checkout.squadco.com/squad.min.js"
    : "https://sandbox.squadco.com/squad.min.js";

interface SquadPayButtonProps {
  email: string;
  /** Amount in Naira (will be multiplied by 100 to convert to kobo). */
  amount: number;
  label: string;
  onPaymentSuccess: () => void;
}

type PaymentState = "idle" | "loading" | "verifying" | "success";

export default function SquadPayButton({
  email,
  amount,
  label,
  onPaymentSuccess,
}: SquadPayButtonProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const squadRef = useRef<InstanceType<typeof window.squad> | null>(null);

  // Clean up the Squad overlay if the component unmounts mid-flow.
  useEffect(() => {
    return () => {
      squadRef.current = null;
    };
  }, []);

  async function verifyAndActivate(transactionRef: string) {
    setPaymentState("verifying");
    try {
      const res = await fetch("/api/squad/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionRef }),
      });

      const data = await res.json();

      if (res.ok && data.status === "ok") {
        setPaymentState("success");
        toast.success("Payment confirmed! Your account is now active.");
        onPaymentSuccess();
      } else {
        setPaymentState("idle");
        toast.error(data.error ?? "Payment verification failed. Please contact support.");
      }
    } catch {
      setPaymentState("idle");
      toast.error("Network error during verification. Please contact support if payment was deducted.");
    }
  }

  function openSquadPopup() {
    if (!scriptLoaded || typeof window.squad === "undefined") {
      toast.error("Payment system is not ready yet. Please try again in a moment.");
      return;
    }

    if (paymentState !== "idle") return;
    setPaymentState("loading");

    try {
      const instance = new window.squad({
        key: process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY!,
        email,
        amount: amount * 100, // convert Naira → kobo
        currency_code: "NGN",
        // CallBack_URL is used by Squad as a redirect fallback on mobile browsers
        // when the popup cannot be rendered. It returns the user to this page.
        // onSuccess handles the normal inline-popup flow.
        ...(process.env.NEXT_PUBLIC_BASE_URL
          ? { CallBack_URL: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-instructions` }
          : {}),
        onLoad: () => {
          setPaymentState("idle");
        },
        onClose: () => {
          setPaymentState("idle");
        },
        onSuccess: async (data) => {
          const ref = data?.transaction_ref;
          if (!ref) {
            toast.error("Payment reference missing. Please contact support.");
            setPaymentState("idle");
            return;
          }
          await verifyAndActivate(ref);
        },
      });

      squadRef.current = instance;
      instance.setup();
      instance.open();
    } catch (err) {
      console.error("Squad popup error:", err);
      setPaymentState("idle");
      toast.error("Could not open payment window. Please try again.");
    }
  }

  const isDisabled = !scriptLoaded || paymentState !== "idle";

  return (
    <>
      <Script
        src={SQUAD_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => {
          toast.error("Failed to load payment system. Please refresh the page.");
        }}
      />

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-60"
        onClick={openSquadPopup}
        disabled={isDisabled}
      >
        {paymentState === "verifying" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming payment…
          </>
        ) : paymentState === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening payment…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </>
  );
}
