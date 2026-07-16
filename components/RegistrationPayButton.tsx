"use client";

import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

const SQUAD_SDK_URL = "https://checkout.squadco.com/widget/squad.min.js";

type SquadCtor = new (cfg: Record<string, unknown>) => { setup(): void; open(): void };

function getSquadCtor(): SquadCtor | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w["@squad"] ?? w.Squad ?? w.squad;
}

let sdkPromise: Promise<void> | null = null;

function loadSquadSdk(): Promise<void> {
  if (getSquadCtor()) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    // Temporarily hide window.module so the UMD bundle falls back to window["@squad"]
    // instead of module.exports (React DevTools sets window.module in dev mode).
    const savedModule = w.module;
    w.module = undefined;

    const script = document.createElement("script");
    script.src = SQUAD_SDK_URL;
    script.onload = () => {
      w.module = savedModule;
      if (!getSquadCtor()) {
        reject(new Error("Squad SDK loaded but constructor not found on window"));
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      w.module = savedModule;
      sdkPromise = null;
      reject(new Error("Squad SDK script failed to load"));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

interface Props {
  email: string;
  amount: number;
  label?: string;
  onSuccess?: (transactionRef: string) => void;
  onClose?: () => void;
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
  const squadRef = useRef<{ setup(): void; open(): void } | null>(null);

  async function handlePay() {
    if (!email || !amount) {
      setError("Email and amount are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loadSquadSdk();
    } catch (err) {
      setError("Failed to load payment SDK. Please refresh and try again.");
      setLoading(false);
      console.error(err);
      return;
    }

    const SquadConstructor = getSquadCtor();
    if (!SquadConstructor) {
      setError("Payment SDK failed to initialize. Please refresh and try again.");
      setLoading(false);
      return;
    }

    try {
      const amountInKobo = Math.round(amount * 100);

      const initRes = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: amountInKobo, payType: "registration" }),
      });
      const initResult = await initRes.json();

      if (!initRes.ok || !initResult.success) {
        setError(initResult.message ?? "Failed to initiate payment.");
        setLoading(false);
        return;
      }

      const transactionRef = initResult.data?.transaction_ref;
      const verifyToken = initResult.data?._verifyToken;
      const verifyExpiry = initResult.data?._verifyExpiry;
      if (!transactionRef) {
        setError("Payment initiation returned no transaction reference.");
        setLoading(false);
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
        onSuccess: async (data: { transaction_ref: string }) => {
          const delays = [2000, 4000, 8000];
          for (let attempt = 0; attempt <= delays.length; attempt++) {
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, delays[attempt - 1]));
            }
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
                return;
              }
              if (attempt < delays.length) continue;
              console.error("[verify-registration] failed after retries:", verifyData?.message);
            } catch (err) {
              if (attempt < delays.length) continue;
              console.error("[verify-registration] network error:", err);
            }
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
