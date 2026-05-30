"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SquadPayType } from "@/components/SquadPayButton";

type Status = "verifying" | "success" | "failed";

const REDIRECT_DELAY = 3;

const VERIFY_ENDPOINT: Record<SquadPayType, string> = {
  registration: "/api/squad/verify-registration",
  contribution: "/api/squad/verify-contribution",
};

const SUCCESS_MESSAGES: Record<SquadPayType, { heading: string; body: string }> = {
  registration: {
    heading: "Payment Confirmed!",
    body: "Your registration fee has been received. Your account is now active.",
  },
  contribution: {
    heading: "Contribution Recorded!",
    body: "Your daily contribution has been confirmed and your days have been credited.",
  },
};

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [countdown, setCountdown] = useState(REDIRECT_DELAY);
  const [payType, setPayType] = useState<SquadPayType>("registration");

  useEffect(() => {
    const transactionRef =
      searchParams.get("transaction_ref") ??
      searchParams.get("transactionRef") ??
      sessionStorage.getItem("squad_tx_ref");

    const token = sessionStorage.getItem("squad_tx_token");
    const expiryRaw = sessionStorage.getItem("squad_tx_expiry");
    const txType = (sessionStorage.getItem("squad_tx_type") ?? "registration") as SquadPayType;

    setPayType(txType);

    if (!transactionRef) {
      setErrorMessage("No transaction reference found. Please contact support.");
      setStatus("failed");
      return;
    }

    if (!token || !expiryRaw) {
      setErrorMessage("Payment session expired or invalid. Please try again.");
      setStatus("failed");
      return;
    }

    const expiry = Number(expiryRaw);

    sessionStorage.removeItem("squad_tx_ref");
    sessionStorage.removeItem("squad_tx_token");
    sessionStorage.removeItem("squad_tx_expiry");
    sessionStorage.removeItem("squad_tx_type");

    const endpoint = VERIFY_ENDPOINT[txType] ?? VERIFY_ENDPOINT.registration;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionRef, token, expiry }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data?.status === "ok") {
          setStatus("success");
        } else {
          setErrorMessage(data?.error ?? "Payment verification failed.");
          setStatus("failed");
        }
      })
      .catch(() => {
        setErrorMessage("Network error during verification. Please contact support.");
        setStatus("failed");
      });
  }, [searchParams]);

  useEffect(() => {
    if (status !== "success") return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.replace("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, router]);

  const successMsg = SUCCESS_MESSAGES[payType];
  const retryPath =
    payType === "contribution" ? "/dashboard" : "/payment-instructions";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-sm p-8 text-center space-y-5"
      >
        {status === "verifying" && (
          <>
            <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mx-auto" />
            <h1 className="text-xl font-bold">Verifying your payment…</h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your transaction with the payment gateway.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-bold">{successMsg.heading}</h1>
            <p className="text-sm text-muted-foreground">{successMsg.body}</p>
            <p className="text-xs text-muted-foreground">
              Redirecting to your dashboard in {countdown}s…
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => router.replace("/dashboard")}
            >
              Go to Dashboard Now
            </Button>
          </>
        )}

        {status === "failed" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Verification Failed</h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.replace(retryPath)}
              >
                Try Again
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => router.replace("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
