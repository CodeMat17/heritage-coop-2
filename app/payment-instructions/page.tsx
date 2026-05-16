"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Copy, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ACCOUNT_NAME = process.env.NEXT_PUBLIC_SQUAD_ACCOUNT_NAME ?? "HERITAGE PORT-HARCOURT MULTI-PURPOSE CO-OPERATIVE SOCIETY LIMITED";
const ACCOUNT_NUMBER = process.env.NEXT_PUBLIC_SQUAD_ACCOUNT_NUMBER ?? "0074256241";
const BANK_NAME = process.env.NEXT_PUBLIC_SQUAD_BANK_NAME ?? "STANBIC IBTC BANK PLC";

const REGISTRATION_FEES: Record<string, number> = {
  bronze:  5_000,
  silver:  10_000,
  gold:    20_000,
  diamond: 30_000,
  emerald: 40_000,
};

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

export default function PaymentInstructionsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const convexUser = useQuery(api.users.current);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (convexUser === null) return;
    if (convexUser && !convexUser.isOnboarded) router.replace("/onboarding");
    else if (convexUser && !convexUser.selectedPackage) router.replace("/select-package");
    else if (convexUser?.registrationPaid) router.replace("/dashboard");
  }, [convexUser, router]);

  if (isLoading || convexUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const ref = convexUser?.registrationRef ?? "—";
  const pkg = convexUser?.selectedPackage ?? "";
  const fee = REGISTRATION_FEES[pkg] ?? 0;
  const pkgLabel = pkg ? pkg.charAt(0).toUpperCase() + pkg.slice(1) : "";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Complete Your Registration</h1>
          <p className="text-sm text-muted-foreground">
            Transfer the registration fee to activate your {pkgLabel} account.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm p-6 space-y-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {pkgLabel} package — registration fee
            </p>
            <p className="text-3xl font-bold text-emerald-600">{fmt(fee)}</p>
          </div>

          <div className="space-y-3">
            {[
              { label: "Bank name", value: BANK_NAME },
              { label: "Account number", value: ACCOUNT_NUMBER },
              { label: "Account name", value: ACCOUNT_NAME },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copy(value, label)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-1">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
              Important — Payment narration / description
            </p>
            <p className="text-xs text-muted-foreground">
              You must include this code as the narration when making the transfer:
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-lg font-bold font-mono tracking-widest">{ref}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copy(ref, "Reference code")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
            <span>
              Your account will be activated automatically within a few minutes of payment.
              This page will redirect you once confirmed — no need to refresh manually.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
