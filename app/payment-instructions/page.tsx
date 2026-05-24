"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";
import SquadPayButton from "@/components/SquadPayButton";

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

  const pkg = convexUser?.selectedPackage ?? "";
  const fee = REGISTRATION_FEES[pkg] ?? 0;
  const pkgLabel = pkg ? pkg.charAt(0).toUpperCase() + pkg.slice(1) : "";
  const email = convexUser?.email ?? "";

  return (
    <div className="min-h-screen bg-muted/30 flex justify-center px-4 py-12">
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
            Pay the registration fee to activate your {pkgLabel} account.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm p-6 space-y-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {pkgLabel} package — registration fee
            </p>
            <p className="text-3xl font-bold text-emerald-600">{fmt(fee)}</p>
          </div>

          {email && fee > 0 ? (
            <SquadPayButton
              email={email}
              amount={fee}
              label={`Pay ${fmt(fee)} Now`}
              onPaymentSuccess={() => router.replace("/dashboard")}
            />
          ) : null}

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
            <span>
              Your account will be activated automatically once payment is confirmed.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
