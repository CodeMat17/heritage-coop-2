"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Squad inline checkout CDN — exports window.squad (lowercase)
const SQUAD_CDN = "https://checkout.squadco.com/widget/squad.min.js";

function loadSquadSdk(): Promise<void> {
  if (typeof window.squad !== "undefined") return Promise.resolve();

  const existing = document.getElementById("squad-sdk");
  if (!existing) {
    const script = document.createElement("script");
    script.id = "squad-sdk";
    script.src = SQUAD_CDN;
    script.async = true;
    document.head.appendChild(script);
  }

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15_000;
    const poll = setInterval(() => {
      if (typeof window.squad !== "undefined") {
        clearInterval(poll);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Squad SDK did not load within 15 s"));
      }
    }, 100);
  });
}

interface Props {
  email: string;
  /** Amount in Naira — converted to kobo internally. */
  amount: number;
  label?: string;
}

export default function RegistrationPayButton({ email, amount, label = "Pay Registration Fee" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;

    const publicKey = process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Payment configuration error. Please contact support.");
      return;
    }

    setLoading(true);

    // 1. Load Squad inline checkout SDK from CDN
    try {
      await loadSquadSdk();
    } catch {
      toast.error("Could not load payment gateway. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    // 2. Generate transaction ref + HMAC token server-side
    let transactionRef: string;
    let token: string;
    let expiry: number;
    try {
      const res = await fetch("/api/squad/init-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount, payType: "registration" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      transactionRef = data.transaction_ref;
      token = data.token;
      expiry = data.expiry;
      if (!transactionRef || !token || !expiry) throw new Error("Incomplete response from server");
    } catch (err) {
      console.error("[RegistrationPayButton] init-payment:", err);
      toast.error("Could not initialise payment. Please try again.");
      setLoading(false);
      return;
    }

    // Persist so /payment-callback can verify
    sessionStorage.setItem("squad_tx_ref", transactionRef);
    sessionStorage.setItem("squad_tx_token", token);
    sessionStorage.setItem("squad_tx_expiry", String(expiry));
    sessionStorage.setItem("squad_tx_type", "registration");

    // 3. Open Squad modal
    try {
      const squadInstance = new window.squad({
        key: publicKey,
        email,
        amount: amount * 100, // kobo
        currency_code: "NGN",
        transaction_ref: transactionRef,
        onLoad: () => setLoading(false),
        onClose: () => setLoading(false),
        onSuccess: (data) => {
          const ref = data?.transaction_ref ?? transactionRef;
          sessionStorage.setItem("squad_tx_ref", ref);
          window.location.href = `${window.location.origin}/payment-callback`;
        },
      });
      squadInstance.setup();
      squadInstance.open();
    } catch (err) {
      console.error("[RegistrationPayButton] modal open:", err);
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
      onClick={handleClick}
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
