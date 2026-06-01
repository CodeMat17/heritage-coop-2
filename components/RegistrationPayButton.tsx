"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SQUAD_SDK_SRC = "/squad.min.js";

type SquadCtor = new (cfg: Record<string, unknown>) => { setup(): void; open(): void };

function resolveSquad(): SquadCtor | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w["@squad"] ?? w.squad ?? w.Squad;
}

let sdkPromise: Promise<void> | null = null;

function loadSquadSdk(): Promise<void> {
  if (resolveSquad()) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    const res = await fetch(SQUAD_SDK_SRC);
    if (!res.ok) throw new Error(`Failed to fetch Squad SDK (HTTP ${res.status})`);
    const code = await res.text();

    // React DevTools sets window.module in dev mode, which makes the SDK's UMD
    // wrapper choose the module.exports branch and skip setting window globals.
    // Shadow module/exports/define as undefined so UMD falls through to the
    // window assignment branch: t["@squad"] = e()
    // eslint-disable-next-line no-new-func
    new Function("module", "exports", "define", code)(undefined, undefined, undefined);

    const ctor = resolveSquad();
    if (!ctor) throw new Error("Squad SDK ran but no constructor found on window");
    console.info("[Squad] SDK ready:", ctor.name || "(anonymous)");
  })().catch((err) => {
    sdkPromise = null; // allow retry on next click
    throw err;
  });

  return sdkPromise;
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

    try {
      await loadSquadSdk();
    } catch (err) {
      console.error("[RegistrationPayButton] SDK load failed:", err);
      toast.error("Could not load payment gateway. Please check your connection and try again.");
      setLoading(false);
      return;
    }

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

    sessionStorage.setItem("squad_tx_ref", transactionRef);
    sessionStorage.setItem("squad_tx_token", token);
    sessionStorage.setItem("squad_tx_expiry", String(expiry));
    sessionStorage.setItem("squad_tx_type", "registration");

    try {
      const SquadCheckout = resolveSquad()!;
      const instance = new SquadCheckout({
        key: publicKey,
        email,
        amount: amount * 100, // kobo
        currency_code: "NGN",
        transaction_ref: transactionRef,
        onLoad: () => setLoading(false),
        onClose: () => setLoading(false),
        onSuccess: (data: { transaction_ref?: string }) => {
          const ref = data?.transaction_ref ?? transactionRef;
          sessionStorage.setItem("squad_tx_ref", ref);
          window.location.href = `${window.location.origin}/payment-callback`;
        },
      });
      instance.setup();
      instance.open();
    } catch (err) {
      console.error("[RegistrationPayButton] modal open failed:", err);
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
