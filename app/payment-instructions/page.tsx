"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const REGISTRATION_FEES: Record<string, number> = {
  bronze:  5_000,
  silver:  10_000,
  gold:    20_000,
  diamond: 30_000,
  emerald: 40_000,
};

const SQUAD_PAYMENT_LINKS: Record<string, string> = {
  bronze:  process.env.NEXT_PUBLIC_SQUAD_LINK_BRONZE  ?? "",
  silver:  process.env.NEXT_PUBLIC_SQUAD_LINK_SILVER  ?? "",
  gold:    process.env.NEXT_PUBLIC_SQUAD_LINK_GOLD    ?? "",
  diamond: process.env.NEXT_PUBLIC_SQUAD_LINK_DIAMOND ?? "",
  emerald: process.env.NEXT_PUBLIC_SQUAD_LINK_EMERALD ?? "",
};

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function buildSquadUrl(baseUrl: string, name: string, email: string): string {
  const url = new URL(baseUrl);
  if (name) url.searchParams.set("name", name);
  if (email) url.searchParams.set("email", email);
  return url.toString();
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
  const baseLink = SQUAD_PAYMENT_LINKS[pkg] ?? "";
  const squadLink =
    baseLink && convexUser
      ? buildSquadUrl(baseLink, convexUser.name ?? "", convexUser.email ?? "")
      : baseLink;

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

          {squadLink ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={() => { window.location.href = squadLink; }}>
              <CreditCard className="h-4 w-4" />
              {`Pay ${fmt(fee)} Now`}
            </Button>
          ) : null}

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
