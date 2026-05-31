"use client";

import { useState } from "react";
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
const CALLBACK_PATH = "/payment-callback";
const LOAD_TIMEOUT_MS = 30_000;
const SDK_LOAD_TIMEOUT_MS = 15_000;

function loadSquadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("[Squad] loadSquadSdk called, window.squad=", typeof window.squad);
    if (typeof window.squad !== "undefined") {
      console.log("[Squad] already loaded, resolving");
      resolve();
      return;
    }

    const existing = document.getElementById("squad-sdk") as HTMLScriptElement | null;
    console.log("[Squad] existing script tag=", existing, "failed=", existing?.dataset.failed);
    if (existing) {
      if (existing.dataset.failed) {
        existing.remove();
      } else {
        console.log("[Squad] piggybacking on in-flight script");
        const timer = setTimeout(
          () => { console.error("[Squad] piggyback timed out"); reject(new Error("Squad SDK load timed out")); },
          SDK_LOAD_TIMEOUT_MS
        );
        existing.addEventListener("load", () => { clearTimeout(timer); console.log("[Squad] piggyback resolved"); resolve(); });
        existing.addEventListener("error", () => { clearTimeout(timer); console.error("[Squad] piggyback error"); reject(new Error("Squad SDK failed to load")); });
        return;
      }
    }

    console.log("[Squad] injecting script tag, src=", SQUAD_SDK_URL);
    const script = document.createElement("script");
    script.id = "squad-sdk";
    script.src = SQUAD_SDK_URL;
    const timer = setTimeout(() => {
      console.error("[Squad] script load timed out");
      script.remove();
      reject(new Error("Squad SDK load timed out"));
    }, SDK_LOAD_TIMEOUT_MS);
    script.onload = () => { clearTimeout(timer); console.log("[Squad] script onload fired, window.squad=", typeof window.squad); resolve(); };
    script.onerror = (e) => {
      clearTimeout(timer);
      script.dataset.failed = "1";
      console.error("[Squad] script onerror:", e, script.src);
      reject(new Error("Squad SDK failed to load"));
    };
    document.head.appendChild(script);
    console.log("[Squad] script tag appended to head");
  });
}

export default function SquadPayButton({
  email,
  amount,
  label,
  type = "registration",
}: SquadPayButtonProps) {
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
    } catch (err) {
      console.error("[Squad] loadSquadSdk rejected:", err);
      toast.error("Could not load payment gateway. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    if (typeof window.squad === "undefined") {
      toast.error("Payment gateway unavailable. Please refresh and try again.");
      setLoading(false);
      return;
    }

    const transactionRef = `HC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const callbackUrl = `${window.location.origin}${CALLBACK_PATH}`;

    // Obtain a server-signed token bound to this transactionRef, payType, and a
    // 15-minute expiry. The verify endpoint rejects any ref that arrives without
    // a matching unexpired token for the correct payType.
    let token: string;
    let expiry: number;
    try {
      const initRes = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionRef, payType: type }),
      });
      if (!initRes.ok) throw new Error("init-payment failed");
      const initData = await initRes.json();
      token = initData.token;
      expiry = initData.expiry;
      if (!token || !expiry) throw new Error("Incomplete token data returned");
    } catch {
      toast.error("Could not initialise payment. Please try again.");
      setLoading(false);
      return;
    }

    // Store ref, token, expiry, and type before opening so they survive
    // navigation to the callback page even if the browser doesn't fire onSuccess.
    sessionStorage.setItem("squad_tx_ref", transactionRef);
    sessionStorage.setItem("squad_tx_token", token);
    sessionStorage.setItem("squad_tx_expiry", String(expiry));
    sessionStorage.setItem("squad_tx_type", type);

    // Fallback: reset loading if onLoad never fires (e.g. SDK hang / network issue).
    const loadFallback = setTimeout(() => setLoading(false), LOAD_TIMEOUT_MS);

    try {
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amount * 100,
        currency_code: "NGN",
        transaction_ref: transactionRef,
        CallBack_URL: callbackUrl,
        onLoad: () => {
          clearTimeout(loadFallback);
          setLoading(false);
        },
        onClose: () => {
          clearTimeout(loadFallback);
          setLoading(false);
        },
        onSuccess: (data) => {
          // Squad may normalise the ref; keep sessionStorage in sync.
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
