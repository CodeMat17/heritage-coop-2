"use client";

import { api } from "@/convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Wallet,
  AlertCircle,
  ChevronRight,
  Settings,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import ContributionPayButton from "@/components/ContributionPayButton";
import FlexibleContributionPayButton from "@/components/FlexibleContributionPayButton";

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
  cursor.setUTCHours(0, 0, 0, 0);
  let i = 0;
  while (dates.length < daysCount) {
    const iso = cursor.toISOString().split("T")[0];
    if (!contributed.has(iso)) dates.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (++i > 365) break;
  }
  return dates;
}

function formatDateDisplay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateDisplay2(ts: number) {
  return new Date(ts).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const convexUser = useQuery(api.users.current);
  const stats = useQuery(api.userContributions.getMyStats);
  const contributions = useQuery(api.userContributions.getMyContributions);
  const loans = useQuery(api.userLoans.getMyLoans);
  const packagesData = useQuery(api.packages.list);
  const PACKAGES: Record<
    string,
    {
      name: string;
      daily: number;
      loan: number;
      durationDays: number;
      flexibleDaily?: boolean;
    }
  > = Object.fromEntries(
      (packagesData ?? []).map((p) => [
        p.packageId,
        {
          name: p.name,
          daily: p.daily,
          loan: p.loanMax,
          durationDays: p.durationDays,
          flexibleDaily: p.flexibleDaily,
        },
      ])
    );
  const interestStatus = useQuery(api.interest.getMyInterestStatus);
  const applyForLoan = useMutation(api.userLoans.applyForLoan);

  const [daysCount, setDaysCount] = useState(1);
  const [applying, setApplying] = useState(false);
  const [loanAmountInput, setLoanAmountInput] = useState("");
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);

  // Auth guards
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/sign-in");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (convexUser === undefined) return;
    if (convexUser === null || !convexUser.isOnboarded) { router.replace("/onboarding"); return; }
    if (!convexUser.selectedPackage) { router.replace("/select-package"); return; }
    if (!convexUser.registrationPaid) router.replace("/payment-instructions");
  }, [convexUser, clerkUser, router]);

  const pkg = convexUser?.selectedPackage ? PACKAGES[convexUser.selectedPackage] : null;
  const daysContributed = stats?.daysContributed ?? 0;
  const daysRemaining = stats?.daysRemaining ?? pkg?.durationDays ?? 90;
  const totalAmount = stats?.totalAmount ?? 0;
  const isEligible = stats?.isLoanEligible ?? false;
  const contributedDates = useMemo(
    () => stats?.contributedDates ?? [],
    [stats?.contributedDates]
  );

  const dateAmounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contributions ?? []) {
      if (c.status !== "success") continue;
      const perDay = c.coveredDates.length > 0 ? c.amount / c.coveredDates.length : 0;
      for (const d of c.coveredDates) map.set(d, perDay);
    }
    return map;
  }, [contributions]);

  const datesToPay = useMemo(
    () => getNextUnpaidDates(contributedDates, daysCount),
    [contributedDates, daysCount]
  );

  const amountToPay = pkg ? pkg.daily * daysCount : 0;
  const durationDays =
    (pkg?.flexibleDaily ? interestStatus?.unlockDays : pkg?.durationDays) ??
    pkg?.durationDays ??
    90;
  const progressPct = Math.min(100, Math.round((daysContributed / durationDays) * 100));

  const firstName = convexUser?.name?.split(" ")[0] || "Member";

  const hasActiveLoan = (loans ?? []).some((l) =>
    ["pending", "approved", "disbursed"].includes(l.status)
  );

  async function handleApplyForLoan() {
    if (!convexUser?.selectedPackage || !pkg) return;
    const amount = Number(loanAmountInput);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid loan amount.");
      return;
    }
    if (amount > pkg.loan) {
      toast.error(`Amount cannot exceed your loan cap of ${fmt(pkg.loan)}.`);
      return;
    }
    setApplying(true);
    try {
      await applyForLoan({ amount, packageId: convexUser.selectedPackage });
      toast.success("Loan application submitted!");
      setLoanDialogOpen(false);
      setLoanAmountInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply for loan.");
    } finally {
      setApplying(false);
    }
  }

  const ADMIN_ROLES = ["content-admin", "finance-admin", "assist-admin", "finance-assist-admin", "super-admin"];
  const isAdmin = ADMIN_ROLES.includes(clerkUser?.publicMetadata?.role as string);

  if (!convexUser || !pkg || packagesData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-muted/30'>
      <div className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className='flex flex-col sm:flex-row items-start justify-between gap-4'>
          <div>
            <p className='text-muted-foreground text-sm'>{getGreeting()},</p>
            <h1 className='text-2xl sm:text-3xl font-bold mt-0.5'>
              {firstName} <span className='text-lg'>👋</span>
            </h1>
            <div className='flex items-center gap-2 mt-2'>
              <Badge
                variant='outline'
                className='border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 capitalize'>
                {pkg.name} Package
              </Badge>
              {isEligible && (
                <Badge className='bg-emerald-600 text-white'>
                  Loan Eligible ✓
                </Badge>
              )}
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Link href='/'>
              <Button variant='outline' size='sm' className='text-xs'>
                <ArrowLeft className='h-3.5 w-3.5' />
                Homepage
              </Button>
            </Link>

            {isAdmin && (
              <Link href='/dashboard/admin'>
                <Button variant='outline' size='sm' className='gap-1.5'>
                  <Settings className='h-3.5 w-3.5' /> Admin
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          {[
            {
              label: "Days contributed",
              value: `${daysContributed}/${durationDays}`,
              icon: Calendar,
              color: "text-emerald-600",
            },
            {
              label: "Total saved",
              value: fmt(totalAmount),
              icon: Wallet,
              color: "text-blue-600",
            },
            {
              label: "Days remaining",
              value: `${daysRemaining} days`,
              icon: Clock,
              color: "text-amber-600",
            },
            {
              label: "Loan entitlement",
              value: fmt(pkg.loan),
              icon: TrendingUp,
              color: "text-purple-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className='rounded-2xl bg-card border border-border p-5 shadow-sm'>
              <div className='flex items-center gap-2 mb-3'>
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className='text-xs text-muted-foreground'>{s.label}</span>
              </div>
              <p className='text-xl font-bold'>{s.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Payment section */}
        {pkg.flexibleDaily ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
            <h2 className='font-semibold mb-1'>Flexible Contribution</h2>
            <p className='text-sm text-muted-foreground mb-5'>
              Contribute any amount, any time — no fixed daily rate.
            </p>

            <Separator className='mb-5' />

            {stats?.lastPaymentDate && (
              <p className='text-xs text-muted-foreground mb-4'>
                Last payment:{" "}
                {new Date(stats.lastPaymentDate).toLocaleDateString("en-NG", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}

            {convexUser?.email && (
              <FlexibleContributionPayButton email={convexUser.email} />
            )}
            <p className='text-xs text-muted-foreground mt-3'>
              Your savings balance will be updated automatically once payment is
              confirmed.
            </p>
          </motion.div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
          <h2 className='font-semibold mb-1'>Daily Contribution</h2>
          <p className=' text-emerald-600 font-bold text-xl mb-5'>
            {fmt(pkg.daily)}/day
          </p>

          {/* Day selector */}
          {/* <div className='mb-5'>
            <p className='text-sm font-medium mb-3'>
              Number of days to pay for
            </p>
            <div className='flex flex-wrap gap-2'>
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type='button'
                  onClick={() => setDaysCount(d)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    daysCount === d
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border bg-background hover:border-emerald-400 hover:text-emerald-600"
                  }`}>
                  {d} {d === 1 ? "day" : "days"}
                </button>
              ))}
            </div>
          </div> */}

          {/* Dates preview */}
          {/* <div className='mb-5'>
            <p className='text-sm font-medium mb-3'>Dates being paid for</p>
            <div className='space-y-2 max-h-48 overflow-y-auto pr-1'>
              {datesToPay.map((d) => (
                <div
                  key={d}
                  className='flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2'>
                  <span className='text-sm'>{formatDateDisplay(d)}</span>
                  <span className='text-sm font-medium'>{fmt(pkg.daily)}</span>
                </div>
              ))}
            </div>
          </div> */}

          <Separator className='mb-5' />

          {/* Total + pay button */}
          {/* <div className='flex items-center mb-5 gap-1'>
           
            <p className='text-2xl font-bold text-emerald-600'>
              {fmt(amountToPay)}
            </p>
            <span>/ day</span>
          </div> */}

          {stats?.lastPaymentDate && (
            <p className='text-xs text-muted-foreground mb-4'>
              Last payment:{" "}
              {new Date(stats.lastPaymentDate).toLocaleDateString("en-NG", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}

          {convexUser?.email && amountToPay > 0 && (
            <ContributionPayButton
              email={convexUser.email}
              amount={amountToPay}
              label={`Pay ${fmt(amountToPay)}`}
            />
          )}
          <p className='text-xs text-muted-foreground mt-3'>
            Your contribution days will be updated automatically once payment is
            confirmed.
          </p>
        </motion.div>
        )}

        {/* Interest status (flexible packages only) */}
        {interestStatus && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
            <h2 className='font-semibold mb-1'>Interest</h2>
            <p className='text-sm text-muted-foreground mb-4'>
              Principal saved: {fmt(interestStatus.principal)}
            </p>
            {interestStatus.unlocked ? (
              <p className='text-emerald-600 font-bold text-xl'>
                5% interest unlocked: {fmt(interestStatus.interestAmount)}
              </p>
            ) : (
              <p className='text-amber-600 font-medium'>
                Unlocks in {Math.max(0, interestStatus.unlockDays - interestStatus.daysSaved)} day
                {Math.max(0, interestStatus.unlockDays - interestStatus.daysSaved) === 1 ? "" : "s"}
                {" "}({interestStatus.daysSaved}/{interestStatus.unlockDays} days saved)
              </p>
            )}
          </motion.div>
        )}

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
          {/* <div className='flex items-center justify-between mb-4'>
            <h2 className='font-semibold'>90-Day Progress</h2>
            <span className='text-sm text-muted-foreground'>
              {daysContributed} / 90 days
            </span>
          </div> */}
          {/* <div className='relative mb-2'>
            <Progress
              value={progressPct}
              className='h-3 rounded-full bg-muted'
            />
          </div> */}
          {/* <div className='flex items-center justify-between text-xs text-muted-foreground mb-4'>
            <span>Day 0</span>
            <span className='font-medium text-emerald-600'>{progressPct}%</span>
            <span>Day 90</span>
          </div> */}

          {/* Day-by-day breakdown */}
          <div className='mb-6 space-y-4'>
            {/* 90-cell visual grid */}
            <div>
              <h2 className=' font-semibold mb-2 uppercase tracking-wide'>
                {durationDays}-Day contribution map
              </h2>
              <div className='flex flex-wrap gap-1'>
                {Array.from({ length: durationDays }, (_, i) => {
                  const paid = i < daysContributed;
                  return (
                    <div
                      key={i}
                      title={
                        paid
                          ? `Day ${i + 1} — paid`
                          : `Day ${i + 1} — remaining`
                      }
                      className={`h-4 w-4 rounded-sm transition-colors ${
                        paid
                          ? "bg-emerald-500"
                          : "bg-muted border border-border"
                      }`}
                    />
                  );
                })}
              </div>
              <div className='flex items-center gap-4 mt-2'>
                <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <span className='inline-block h-3 w-3 rounded-sm bg-emerald-500' />
                  {daysContributed} days paid
                </span>
                <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <span className='inline-block h-3 w-3 rounded-sm bg-muted border border-border' />
                  {daysRemaining} days remaining
                </span>
              </div>
            </div>

            {/* Paid-date list */}
            {contributedDates.length > 0 && (
              <div>
                <p className='text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide'>
                  Payment dates
                </p>
                <div className='space-y-1.5 max-h-44 overflow-y-auto pr-1'>
                  {[...contributedDates]
                    .sort((a, b) => b.localeCompare(a))
                    .map((iso, idx) => (
                      <div
                        key={iso}
                        className='flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 px-3 py-2'>
                        <div className='flex items-center gap-2'>
                          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-500 shrink-0' />
                          <span className='text-xs font-medium'>
                            Day {daysContributed - idx}
                          </span>
                          <span className='text-xs text-muted-foreground'>
                            {formatDateDisplay(iso)}
                          </span>
                        </div>
                        <span className='text-xs font-semibold text-emerald-700 dark:text-emerald-400'>
                          {fmt(dateAmounts.get(iso) ?? pkg.daily)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {pkg.loan === 0 ? (
            <p className='text-sm text-muted-foreground'>
              This package does not include loan eligibility.
            </p>
          ) : isEligible ? (
            <div className='p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'>
              <div className='flex items-center gap-2'>
                <CheckCircle2 className='h-4 w-4 text-emerald-600 shrink-0' />
                <p className='text-sm text-emerald-700 dark:text-emerald-400 font-medium'>
                  Congratulations! You are eligible for a loan of up to{" "}
                  {fmt(pkg.loan)}.
                </p>
                {!hasActiveLoan && <ChevronRight className='h-4 w-4 text-emerald-600 ml-auto' />}
              </div>
              {hasActiveLoan ? (
                <p className='text-xs text-muted-foreground mt-2'>
                  You already have an active loan application.
                </p>
              ) : (
                <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className='bg-emerald-600 hover:bg-emerald-700 text-white mt-3'
                      size='sm'>
                      Apply for a Loan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Apply for a Loan</DialogTitle>
                    </DialogHeader>
                    <div className='space-y-3'>
                      <p className='text-sm text-muted-foreground'>
                        Your maximum loan cap for the {pkg.name} package is{" "}
                        <span className='font-semibold text-foreground'>
                          {fmt(pkg.loan)}
                        </span>
                        . Enter the amount you&apos;d like to apply for.
                      </p>
                      <div className='space-y-1.5'>
                        <Label htmlFor='loan-amount'>Loan amount (₦)</Label>
                        <Input
                          id='loan-amount'
                          type='number'
                          min={1}
                          max={pkg.loan}
                          value={loanAmountInput}
                          onChange={(e) => setLoanAmountInput(e.target.value)}
                          placeholder={`Up to ${fmt(pkg.loan)}`}
                        />
                      </div>
                      <Button
                        onClick={handleApplyForLoan}
                        disabled={applying}
                        className='bg-emerald-600 hover:bg-emerald-700 text-white w-full'>
                        {applying ? "Submitting…" : "Submit Application"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {daysRemaining} more {daysRemaining === 1 ? "day" : "days"} of
              contributions to unlock your {fmt(pkg.loan)} loan entitlement.
            </p>
          )}
        </motion.div>

        {/* Calendar */}
        {/* <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
          <ContributionCalendar contributedDates={contributedDates} />
        </motion.div> */}

        {/* Contribution history */}
        {/* <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
          <div className='flex items-center justify-between mb-5'>
            <h2 className='font-semibold'>Contribution History</h2>
            <span className='text-sm text-muted-foreground'>
              {contributions?.length ?? 0} payment
              {(contributions?.length ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          {!contributions || contributions.length === 0 ? (
            <div className='text-center py-10'>
              <AlertCircle className='h-8 w-8 text-muted-foreground mx-auto mb-2' />
              <p className='text-muted-foreground text-sm'>
                No contributions yet. Make your first payment above!
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {contributions.map((c) => (
                <div
                  key={c._id}
                  className='flex items-center justify-between py-3 border-b border-border last:border-0'>
                  <div>
                    <p className='text-sm font-medium'>Daily Contribution</p>
                    <p className='text-xs text-muted-foreground'>
                      {new Date(c._creationTime).toLocaleDateString("en-NG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-bold'>{fmt(c.amount)}</p>
                    <Badge
                      className={`text-xs ${
                        c.status === "success"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      } border-transparent`}>
                      {c.status === "success"
                        ? "Success"
                        : c.status === "underpayment"
                          ? "Underpayment"
                          : c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div> */}

        {/* Loan section */}
        {loans && loans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
            <h2 className='font-semibold mb-5'>Loan Applications</h2>
            <div className='space-y-3'>
              {loans.map((loan) => (
                <div
                  key={loan._id}
                  className='flex items-center justify-between py-3 border-b border-border last:border-0'>
                  <div>
                    <p className='text-sm font-medium capitalize'>
                      {PACKAGES[loan.packageId]?.name ?? loan.packageId} Package
                      Loan
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Applied {formatDateDisplay2(loan.appliedAt)}
                    </p>
                    {loan.approvedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Approved {formatDateDisplay2(loan.approvedAt)}
                      </p>
                    )}
                    {loan.disbursedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Disbursed {formatDateDisplay2(loan.disbursedAt)}
                      </p>
                    )}
                    {loan.clearedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Cleared {formatDateDisplay2(loan.clearedAt)}
                      </p>
                    )}
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-bold'>{fmt(loan.amount)}</p>
                    <Badge
                      className={`text-xs border-transparent capitalize ${
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
