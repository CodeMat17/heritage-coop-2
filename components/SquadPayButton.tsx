"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SquadPayButtonProps {
  email: string;
  /** Amount in Naira (will be multiplied by 100 to convert to kobo). */
  amount: number;
  label: string;
  onPaymentSuccess: () => void;
}

type PaymentState = "idle" | "loading";

export default function SquadPayButton({
  email,
  amount,
  label,
}: SquadPayButtonProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");

  async function initiatePayment() {
    if (paymentState !== "idle") return;
    setPaymentState("loading");

    try {
      const res = await fetch("/api/squad/initiate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: amount * 100 }),
      });

      const data = await res.json();

      if (!res.ok || !data?.checkout_url) {
        toast.error(data?.error ?? "Could not initiate payment. Please try again.");
        setPaymentState("idle");
        return;
      }

      // Squad opens the payment modal when the checkout URL is visited.
      // Store the ref so the callback page can verify it.
      if (data.transaction_ref) {
        sessionStorage.setItem("squad_tx_ref", data.transaction_ref);
      }

      window.location.href = data.checkout_url;
    } catch {
      toast.error("Network error. Please check your connection and try again.");
      setPaymentState("idle");
    }
  }

  return (
    <Button
      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-60"
      onClick={initiatePayment}
      disabled={paymentState !== "idle"}
    >
      {paymentState === "loading" ? (
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
  );
}
