"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SquadPayButtonProps {
  email: string;
  /** Amount in Naira (converted to kobo internally). */
  amount: number;
  label: string;
  onPaymentSuccess: () => void;
}

const SQUAD_SDK_URL = "https://checkout.squadco.com/widget/squad.min.js";
const CALLBACK_PATH = "/payment-callback";

function loadSquadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.squad !== "undefined") {
      resolve();
      return;
    }
    if (document.getElementById("squad-sdk")) {
      // Script tag exists but squad not ready yet — wait for it
      const existing = document.getElementById("squad-sdk") as HTMLScriptElement;
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Squad SDK failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "squad-sdk";
    script.src = SQUAD_SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Squad SDK failed to load"));
    document.head.appendChild(script);
  });
}

export default function SquadPayButton({
  email,
  amount,
  label,
  onPaymentSuccess,
}: SquadPayButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    if (loading) return;

    const publicKey = process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Payment configuration error. Please contact support.");
      return;
    }

    setLoading(true);

    try {
      await loadSquadSdk();
    } catch {
      toast.error("Could not load payment gateway. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    const transactionRef = `HC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const callbackUrl = `${window.location.origin}${CALLBACK_PATH}`;

    try {
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amount * 100,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        CallBack_URL: callbackUrl,
        onLoad: () => {
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
        },
        onSuccess: (data) => {
          const ref = data?.transaction_ref ?? transactionRef;
          sessionStorage.setItem("squad_tx_ref", ref);
          onPaymentSuccess();
          router.push(`${CALLBACK_PATH}?transaction_ref=${encodeURIComponent(ref)}`);
        },
      });

      squadInstance.setup();
      squadInstance.open();
    } catch (err) {
      console.error("Squad modal error:", err);
      toast.error("Could not open payment modal. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-60"
      onClick={handlePayment}
      disabled={loading}
    >
      {loading ? (
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
