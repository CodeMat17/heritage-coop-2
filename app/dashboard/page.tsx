"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import SquadPayButton from "@/components/SquadPayButton";
import {
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Wallet,
  AlertCircle,
  ChevronRight,
  Settings,
} from "lucide-react";
import Link from "next/link";
import type { SquadVerifyResponse } from "@/types/squad";

const PACKAGES: Record<string, { name: string; daily: number; loan: number }> = {
  bronze:  { name: "Bronze",  daily: 500,    loan: 100_000 },
  silver:  { name: "Silver",  daily: 1_000,  loan: 180_000 },
  gold:    { name: "Gold",    daily: 2_000,  loan: 360_000 },
  diamond: { name: "Diamond", daily: 5_000,  loan: 1_000_000 },
  emerald: { name: "Emerald", daily: 10_000, loan: 2_000_000 },
};

const DAY_OPTIONS = [1, 2, 3, 5, 7, 14, 30];

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getNextUnpaidDates(contributedDates: string[], daysCount: number): string[] {
  const contributed = new Set(contributedDates);
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let i = 0;
  while (dates.length < daysCount) {
    const iso = cursor.toISOString().split("T")[0];
    if (!contributed.has(iso)) dates.push(iso);
    cursor.setDate(cursor.getDate() + 1);
    if (++i > 365) break;
  }
  return dates;
}

function formatDateDisplay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function genRef() {
  return `HCO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// Last-30-days contribution calendar
function ContributionCalendar({ contributedDates }: { contributedDates: string[] }) {
  const contributed = new Set(contributedDates);
  const days: { iso: string; label: string; contributed: boolean; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    days.push({
      iso,
      label: d.getDate().toString(),
      contributed: contributed.has(iso),
      isToday: i === 0,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Contribution Calendar</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <div
            key={d.iso}
            title={`${d.iso} — ${d.contributed ? "Contributed" : "Missed"}`}
            className={`h-7 w-full rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
              d.isToday
                ? d.contributed
                  ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1"
                  : "bg-amber-400/30 text-amber-700 dark:text-amber-400 ring-2 ring-amber-400 ring-offset-1"
                : d.contributed
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground/50"
            }`}
          >
            {d.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200 dark:bg-emerald-900/40 inline-block" />Contributed</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted inline-block" />Missed</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-300 inline-block" />Today</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isAuthenticated } = useConvexAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const convexUser = useQuery(api.users.current);
  const stats = useQuery(api.userContributions.getMyStats);
  const contributions = useQuery(api.userContributions.getMyContributions);
  const loans = useQuery(api.userLoans.getMyLoans);

  const [daysCount, setDaysCount] = useState(1);
  const [txRef, setTxRef] = useState(() => genRef());

  // Auth guards
  useEffect(() => {
    if (!isAuthenticated) router.replace("/sign-in");
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (convexUser === null) return;
    if (convexUser && !convexUser.isOnboarded) router.replace("/onboarding");
    if (convexUser && convexUser.isOnboarded && !convexUser.selectedPackage) router.replace("/dashboard/select-package");
  }, [convexUser, router]);

  const pkg = convexUser?.selectedPackage ? PACKAGES[convexUser.selectedPackage] : null;
  const daysContributed = stats?.daysContributed ?? 0;
  const daysRemaining = stats?.daysRemaining ?? 90;
  const totalAmount = stats?.totalAmount ?? 0;
  const isEligible = stats?.isLoanEligible ?? false;
  const contributedDates = stats?.contributedDates ?? [];

  const datesToPay = useMemo(
    () => getNextUnpaidDates(contributedDates, daysCount),
    [contributedDates, daysCount]
  );

  const amountToPay = pkg ? pkg.daily * daysCount : 0;
  const progressPct = Math.min(100, Math.round((daysContributed / 90) * 100));

  const firstName = convexUser?.name?.split(" ")[0] || "Member";

  // Regenerate ref after each payment attempt
  function refreshRef() {
    setTxRef(genRef());
  }

  async function onPaySuccess(verification: SquadVerifyResponse) {
    refreshRef();
    const ref = verification.data?.transaction_ref;
    if (!ref) return;
    try {
      // Only the transactionRef is sent — amount, email, and covered dates
      // are all determined server-side from Squad's API and the user's package.
      await fetch("/api/squad/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionRef: ref }),
      });
    } catch (err) {
      console.error("Failed to record contribution directly:", err);
    }
  }

  const isAdmin = clerkUser?.publicMetadata?.role === "admin";

  if (!convexUser || !pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start justify-between gap-4"
        >
          <div>
            <p className="text-muted-foreground text-sm">{getGreeting()},</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-0.5">
              {firstName} <span className="text-lg">👋</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 capitalize">
                {pkg.name} Package
              </Badge>
              {isEligible && (
                <Badge className="bg-emerald-600 text-white">Loan Eligible ✓</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/dashboard/admin">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" /> Admin
                </Button>
              </Link>
            )}
            <Link href="/dashboard/select-package">
              <Button variant="outline" size="sm" className="text-xs">Change Package</Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: "Days contributed", value: `${daysContributed}/90`, icon: Calendar, color: "text-emerald-600" },
            { label: "Total saved", value: fmt(totalAmount), icon: Wallet, color: "text-blue-600" },
            { label: "Days remaining", value: `${daysRemaining} days`, icon: Clock, color: "text-amber-600" },
            { label: "Loan entitlement", value: fmt(pkg.loan), icon: TrendingUp, color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card border border-border p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">90-Day Progress</h2>
            <span className="text-sm text-muted-foreground">{daysContributed} / 90 days</span>
          </div>
          <div className="relative mb-2">
            <Progress value={progressPct} className="h-3 rounded-full bg-muted" />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span>Day 0</span>
            <span className="font-medium text-emerald-600">{progressPct}%</span>
            <span>Day 90</span>
          </div>
          {isEligible ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Congratulations! You are now eligible for a {fmt(pkg.loan)} loan.
              </p>
              <ChevronRight className="h-4 w-4 text-emerald-600 ml-auto" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {daysRemaining} more {daysRemaining === 1 ? "day" : "days"} of contributions to unlock your {fmt(pkg.loan)} loan entitlement.
            </p>
          )}
        </motion.div>

        {/* Payment section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-card border border-border p-6 shadow-sm"
        >
          <h2 className="font-semibold mb-1">Daily Contribution</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {fmt(pkg.daily)}/day · pay today or multiple days ahead
          </p>

          {/* Day selector */}
          <div className="mb-5">
            <p className="text-sm font-medium mb-3">Number of days to pay for</p>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysCount(d)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    daysCount === d
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border bg-background hover:border-emerald-400 hover:text-emerald-600"
                  }`}
                >
                  {d} {d === 1 ? "day" : "days"}
                </button>
              ))}
            </div>
          </div>

          {/* Dates preview */}
          <div className="mb-5">
            <p className="text-sm font-medium mb-3">Dates being paid for</p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {datesToPay.map((d) => (
                <div key={d} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm">{formatDateDisplay(d)}</span>
                  <span className="text-sm font-medium">{fmt(pkg.daily)}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="mb-5" />

          {/* Total */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-muted-foreground">Total amount</p>
              <p className="text-xs text-muted-foreground">to be charged</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{fmt(amountToPay)}</p>
          </div>

          {stats?.lastPaymentDate && (
            <p className="text-xs text-muted-foreground mb-4">
              Last payment: {new Date(stats.lastPaymentDate).toLocaleDateString("en-NG", {
                weekday: "short", day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}

          <SquadPayButton
            email={convexUser.email}
            customerName={convexUser.name ?? ""}
            amount={amountToPay}
            publicKey={process.env.NEXT_PUBLIC_SQUAD_PUBLIC_KEY}
            transactionRef={txRef}
            metadata={{
              coveredDates: datesToPay.join(","),
              daysCount: String(daysCount),
            }}
            onSuccess={onPaySuccess}
            label={`Pay ${fmt(amountToPay)}`}
          />
        </motion.div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-card border border-border p-6 shadow-sm"
        >
          <ContributionCalendar contributedDates={contributedDates} />
        </motion.div>

        {/* Contribution history */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-card border border-border p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Contribution History</h2>
            <span className="text-sm text-muted-foreground">{contributions?.length ?? 0} payment{(contributions?.length ?? 0) !== 1 ? "s" : ""}</span>
          </div>
          {!contributions || contributions.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No contributions yet. Make your first payment above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contributions.map((c) => (
                <div key={c._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">Daily Contribution</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c._creationTime).toLocaleDateString("en-NG", {
                        weekday: "short", day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(c.amount)}</p>
                    <Badge
                      className={`text-xs ${
                        c.status === "success"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700"
                      } border-transparent`}
                    >
                      {c.status === "success" ? "Success" : c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Loan section */}
        {loans && loans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-card border border-border p-6 shadow-sm"
          >
            <h2 className="font-semibold mb-5">Loan Applications</h2>
            <div className="space-y-3">
              {loans.map((loan) => (
                <div key={loan._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium capitalize">{PACKAGES[loan.packageId]?.name ?? loan.packageId} Package Loan</p>
                    <p className="text-xs text-muted-foreground">
                      Applied {new Date(loan.appliedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(loan.amount)}</p>
                    <Badge className={`text-xs border-transparent capitalize ${
                      loan.status === "cleared" || loan.status === "disbursed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : loan.status === "approved"
                        ? "bg-blue-100 text-blue-700"
                        : loan.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {loan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
