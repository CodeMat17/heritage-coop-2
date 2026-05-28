"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "verifying" | "success" | "failed";

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const transactionRef =
      searchParams.get("transaction_ref") ??
      searchParams.get("transactionRef") ??
      sessionStorage.getItem("squad_tx_ref");

    if (!transactionRef) {
      setErrorMessage("No transaction reference found. Please contact support.");
      setStatus("failed");
      return;
    }

    sessionStorage.removeItem("squad_tx_ref");

    fetch("/api/squad/verify-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionRef }),
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
            <h1 className="text-xl font-bold">Payment Confirmed!</h1>
            <p className="text-sm text-muted-foreground">
              Your registration fee has been received. Your account is now active.
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => router.replace("/dashboard")}
            >
              Go to Dashboard
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
                onClick={() => router.replace("/payment-instructions")}
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
