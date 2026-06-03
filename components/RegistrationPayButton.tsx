"use client";

import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  email: string;
  amount: number;
  label?: string;
  onSuccess?: (transactionRef: string) => void;
  onClose?: () => void;
}

interface InitiateResponse {
  status: number;
  success: boolean;
  message: string;
  data?: {
    checkout_url?: string;
    transaction_ref?: string;
    auth_url?: string;
    _verifyToken?: string;
    _verifyExpiry?: number;
  };
}

export default function RegistrationPayButton({
  email,
  amount,
  onSuccess,
  onClose,
  label = "Pay Registration Fee",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const squadRef = useRef<SquadInstance | null>(null);

  useEffect(() => {
    const existing = document.querySelector('script[src*="squad.min.js"]');

    if (existing) {
      const ctor = window["@squad"] ?? window.squad;

      if (typeof ctor !== "undefined") {
        queueMicrotask(() => setSdkReady(true));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "/squad.min.js";
    script.async = true;
    script.onload = () => {
      const squadKeys = Object.keys(window).filter((k) =>
        k.toLowerCase().includes("squad"),
      );
      const ctor =
        ((window as unknown as Record<string, unknown>)[
          squadKeys[0] ?? "@squad"
        ] as (new (config: SquadConfig) => SquadInstance) | undefined) ??
        window["@squad"] ??
        window.squad;
      if (typeof ctor === "undefined") {
        setError(
          `Failed to load payment SDK. Make sure you have the Squad JS SDK installed.`,
        );
      } else {
        setSdkReady(true);
      }
    };
    script.onerror = () => setError("Failed to load payment SDK.");
    document.body.appendChild(script);
  }, []);

  async function handlePay() {
    if (!email || !amount) {
      setError("Email and amount are required.");
      return;
    }
    if (!sdkReady) {
      setError("Payment SDK is still loading. Please try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const amountInKobo = Math.round(amount * 100);

      // Initiate transaction server-side to get a ref and verify legitimacy
      const res = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: amountInKobo, payType: "registration" }),
      });

      const result: InitiateResponse = await res.json();

      if (!res.ok || !result.success) {
        setError(result.message ?? "Failed to initiate payment.");
        return;
      }

      const transactionRef = result.data?.transaction_ref;
      const verifyToken = result.data?._verifyToken;
      const verifyExpiry = result.data?._verifyExpiry;

      const SquadConstructor = window["@squad"] ?? window.Squad ?? window.squad;
      if (!SquadConstructor) {
        setError("Payment SDK failed to initialize. Please refresh and try again.");
        return;
      }
      squadRef.current = new SquadConstructor({
        key: process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY!,
        email,
        amount: amountInKobo,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        onLoad: () => {},
        onClose: () => {
          onClose?.();
        },
        onSuccess: async (data) => {
          try {
            const verifyRes = await fetch(
              `/api/squad/verify-registration/${data.transaction_ref}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: verifyToken, expiry: verifyExpiry }),
              }
            );
            const verifyData = await verifyRes.json();
            if (verifyData?.success) {
              onSuccess?.(data.transaction_ref);
            } else {
              console.error("[verify] failed:", verifyData?.message);
            }
          } catch (err) {
            console.error("[verify] network error:", err);
          }
        },
      });

      squadRef.current.setup();
      squadRef.current.open();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='w-full space-y-2'>
      <Button
        className='w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-60'
        onClick={handlePay}
        disabled={loading}>
        {loading ? (
          <>
            <Loader2 className='h-4 w-4 animate-spin' />
            Opening payment…
          </>
        ) : (
          <>
            <CreditCard className='h-4 w-4' />
            {label}
          </>
        )}
      </Button>
      {error && (
        <p className='text-sm text-red-600 text-center'>{error}</p>
      )}
    </div>
  );
}
