"use client";

import { useState } from "react";
import Script from "next/script";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type SquadPayType = "registration" | "contribution";

interface SquadPayButtonProps {
  email: string;
  /** Amount in Naira (converted to kobo internally). */
  amount: number;
  label: string;
  type?: SquadPayType;
}

const SQUAD_ENV = process.env.NEXT_PUBLIC_SQUAD_ENV ?? "production";
const SQUAD_SDK_URL =
  SQUAD_ENV === "sandbox"
    ? "https://sandbox.squadco.com/widget/squad.min.js"
    : "https://checkout.squadco.com/widget/squad.min.js";
const LOAD_TIMEOUT_MS = 30_000;

export default function SquadPayButton({
  email,
  amount,
  label,
  type = "registration",
}: SquadPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  function retryLoadSdk() {
    if (typeof window === "undefined") return;
    if (document.getElementById("squad-sdk-fallback")) return;
    const s = document.createElement("script");
    s.id = "squad-sdk-fallback";
    s.src = SQUAD_SDK_URL;
    s.async = true;
    s.onload = () => setSdkReady(true);
    s.onerror = () =>
      toast.error("Could not load payment gateway. Please refresh and try again.");
    document.head.appendChild(s);
  }

  async function handlePayment() {
    if (loading) return;

    const publicKey = process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Payment configuration error. Please contact support.");
      return;
    }

    if (!sdkReady || typeof window.squad === "undefined") {
      toast.error("Payment gateway is still loading. Please wait a moment and try again.");
      return;
    }

    setLoading(true);

    // Server calls Squad's initiate API, registers CallBack_URL, and returns
    // Squad's canonical transaction_ref plus an HMAC token for the verify step.
    let transactionRef: string;
    let token: string;
    let expiry: number;
    try {
      const initRes = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, payType: type }),
      });
      if (!initRes.ok) throw new Error("init-payment failed");
      const initData = await initRes.json();
      transactionRef = initData.transaction_ref;
      token = initData.token;
      expiry = initData.expiry;
      if (!transactionRef || !token || !expiry) throw new Error("Incomplete data from init-payment");
    } catch {
      toast.error("Could not initialise payment. Please try again.");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("squad_tx_ref", transactionRef);
    sessionStorage.setItem("squad_tx_token", token);
    sessionStorage.setItem("squad_tx_expiry", String(expiry));
    sessionStorage.setItem("squad_tx_type", type);

    const loadFallback = setTimeout(() => setLoading(false), LOAD_TIMEOUT_MS);

    try {
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amount * 100,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        onLoad: () => {
          clearTimeout(loadFallback);
          setLoading(false);
        },
        onClose: () => {
          clearTimeout(loadFallback);
          setLoading(false);
        },
        onSuccess: (data) => {
          const ref = data?.transaction_ref ?? transactionRef;
          sessionStorage.setItem("squad_tx_ref", ref);
        },
      });

      squadInstance.setup();
      squadInstance.open();
    } catch (err) {
      clearTimeout(loadFallback);
      console.error("Squad modal error:", err);
      sessionStorage.removeItem("squad_tx_ref");
      sessionStorage.removeItem("squad_tx_token");
      sessionStorage.removeItem("squad_tx_expiry");
      sessionStorage.removeItem("squad_tx_type");
      toast.error("Could not open payment modal. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        id="squad-sdk"
        src={SQUAD_SDK_URL}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setScriptError(true);
          retryLoadSdk();
        }}
      />
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:opacity-60"
        onClick={handlePayment}
        disabled={loading || !sdkReady}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening payment…
          </>
        ) : !sdkReady ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {scriptError ? "Retrying…" : "Loading…"}
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
