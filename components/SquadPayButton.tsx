"use client";

import { useRef, useState } from "react";
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

const SQUAD_SDK_URL = "https://checkout.squadco.com/widget/squad.min.js";

const MODAL_TIMEOUT_MS = 30_000;

/** Normalises Squad's global: the SDK may export as window.Squad (capital S). */
function resolveSquadGlobal(): boolean {
  if (typeof window.squad !== "undefined") return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = window as any;
  if (typeof g.Squad !== "undefined") {
    window.squad = g.Squad;
    return true;
  }
  return false;
}

/** Injects the Squad SDK script once and resolves when window.squad is available. */
function loadSquadSdk(): Promise<void> {
  if (resolveSquadGlobal()) return Promise.resolve();

  const existing = document.getElementById("squad-sdk") as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = setInterval(() => {
        if (resolveSquadGlobal()) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - start > 10_000) {
          clearInterval(poll);
          reject(new Error("Squad SDK timeout: window.squad still undefined after 10s"));
        }
      }, 100);
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = "squad-sdk";
    s.src = SQUAD_SDK_URL;
    s.async = true;
    s.onload = () => {
      if (resolveSquadGlobal()) {
        resolve();
        return;
      }
      const start = Date.now();
      const poll = setInterval(() => {
        if (resolveSquadGlobal()) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - start > 10_000) {
          clearInterval(poll);
          reject(new Error("Squad SDK loaded but window.squad/Squad undefined after 10s"));
        }
      }, 50);
    };
    s.onerror = () => {
      reject(new Error(`Failed to load Squad SDK from ${SQUAD_SDK_URL}`));
    };
    document.head.appendChild(s);
  });
}

export default function SquadPayButton({
  email,
  amount,
  label,
  type = "registration",
}: SquadPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const modalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearModalTimeout() {
    if (modalTimeout.current) {
      clearTimeout(modalTimeout.current);
      modalTimeout.current = null;
    }
  }

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
    } catch (sdkErr) {
      console.error("[SquadPayButton] loadSquadSdk failed:", sdkErr);
      toast.error("Could not load payment gateway. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    // Obtain a server-issued transaction_ref and HMAC token.
    // The server generates the ref locally — no Squad API pre-flight needed.
    let transactionRef: string;
    let token: string;
    let expiry: number;
    try {
      const initRes = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, payType: type }),
      });
      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        throw new Error(initData?.error ?? `init-payment HTTP ${initRes.status}`);
      }
      transactionRef = initData.transaction_ref;
      token = initData.token;
      expiry = initData.expiry;
      if (!transactionRef || !token || !expiry) throw new Error("Incomplete data from init-payment");
    } catch (initErr) {
      console.error("[SquadPayButton] init-payment error:", initErr);
      toast.error("Could not initialise payment. Please try again.");
      setLoading(false);
      return;
    }

    // Persist the HMAC token and ref so the callback page can verify the payment.
    sessionStorage.setItem("squad_tx_ref", transactionRef);
    sessionStorage.setItem("squad_tx_token", token);
    sessionStorage.setItem("squad_tx_expiry", String(expiry));
    sessionStorage.setItem("squad_tx_type", type);

    // Safety valve: unlock the button if the modal never fires onLoad/onClose.
    modalTimeout.current = setTimeout(() => setLoading(false), MODAL_TIMEOUT_MS);

    const callbackUrl = `${window.location.origin}/payment-callback`;

    try {
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amount * 100,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        onLoad: () => {
          clearModalTimeout();
          setLoading(false);
        },
        onClose: () => {
          clearModalTimeout();
          setLoading(false);
        },
        onSuccess: (data) => {
          clearModalTimeout();
          const finalRef = data?.transaction_ref ?? transactionRef;
          sessionStorage.setItem("squad_tx_ref", finalRef);
          window.location.href = callbackUrl;
        },
      });

      squadInstance.setup();
      squadInstance.open();
    } catch (err) {
      clearModalTimeout();
      console.error("[SquadPayButton] modal error:", err);
      sessionStorage.removeItem("squad_tx_ref");
      sessionStorage.removeItem("squad_tx_token");
      sessionStorage.removeItem("squad_tx_expiry");
      sessionStorage.removeItem("squad_tx_type");
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
