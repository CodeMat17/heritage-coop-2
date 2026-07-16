"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
  Shield,
  ChevronDown,
  Plus,
  Trash2,
  Download,
  Pencil,
  CalendarIcon,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

function usePackagesLookup() {
  const packages = useQuery(api.packages.list);
  return Object.fromEntries(
    (packages ?? []).map((p) => [
      p.packageId,
      { name: p.name, daily: p.daily, loan: p.loanMax, regFee: p.regFee, durationDays: p.durationDays },
    ])
  ) as Record<string, { name: string; daily: number; loan: number; regFee: number; durationDays: number }>;
}

function fmt(n: number) { return `₦${n.toLocaleString("en-NG")}`; }



function CashContributionDialog({
  userId,
  packageId,
  alreadyCoveredDates,
  registrationPaidAt,
}: {
  userId: Id<"users">;
  packageId: string;
  alreadyCoveredDates: string[];
  registrationPaidAt: number;
}) {
  const recordCashContribution = useAction(api.adminContributions.recordCashContribution);
  const packages = usePackagesLookup();
  const dailyRate = packages[packageId]?.daily ?? 0;
  const [open, setOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const coveredSet = new Set(alreadyCoveredDates);
  const toIso = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  const registrationDate = new Date(registrationPaidAt);
  const registrationDay = new Date(
    registrationDate.getFullYear(),
    registrationDate.getMonth(),
    registrationDate.getDate()
  );

  async function handleSubmit() {
    if (selectedDates.length < 1) {
      toast.error("Select at least one day.");
      return;
    }
    setSubmitting(true);
    try {
      const dates = selectedDates.map(toIso);
      const result = await recordCashContribution({ userId, dates });
      toast.success(`Recorded ${result.daysCount} day(s) covered.`);
      setOpen(false);
      setSelectedDates([]);
    } catch {
      toast.error("Failed to record cash contribution.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8">
          Record Cash Contribution
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Cash Contribution</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Daily rate: {fmt(dailyRate)} · Select the day(s) being paid for (from{" "}
            {registrationDay.toLocaleDateString("en-NG")})
          </p>
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={(d) => setSelectedDates(d ?? [])}
            disabled={(d) => coveredSet.has(toIso(d)) || d < registrationDay}
            className="rounded-lg border"
            captionLayout="dropdown"
          />
          <p className="text-sm font-semibold">
            Total: {fmt(dailyRate * selectedDates.length)} ({selectedDates.length} day
            {selectedDates.length === 1 ? "" : "s"})
          </p>
          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCashDatesDialog({
  contributionId,
  coveredDates,
}: {
  contributionId: Id<"userContributions">;
  coveredDates: string[];
}) {
  const removeCashContributionDates = useMutation(api.adminContributions.removeCashContributionDates);
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState<Set<string>>(new Set(coveredDates));
  const [submitting, setSubmitting] = useState(false);

  function toggle(date: string) {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function handleSave() {
    const datesToRemove = coveredDates.filter((d) => !keep.has(d));
    if (datesToRemove.length === 0) {
      toast.error("Uncheck at least one day to remove.");
      return;
    }
    setSubmitting(true);
    try {
      await removeCashContributionDates({ contributionId, dates: datesToRemove });
      toast.success(`Removed ${datesToRemove.length} day(s).`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update dates.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setKeep(new Set(coveredDates)); }}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-6 w-6 text-muted-foreground hover:text-foreground'>
          <Pencil className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Days Covered</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <p className='text-xs text-muted-foreground'>
            Uncheck any day(s) that were marked in error, then save.
          </p>
          <div className='space-y-1.5 max-h-64 overflow-y-auto'>
            {[...coveredDates].sort().map((d) => (
              <label key={d} className='flex items-center gap-2 text-sm py-1 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={keep.has(d)}
                  onChange={() => toggle(d)}
                  className='h-4 w-4 accent-emerald-600'
                />
                {new Date(d + "T00:00:00").toLocaleDateString("en-NG", {
                  weekday: "short", day: "numeric", month: "short", year: "numeric",
                })}
              </label>
            ))}
          </div>
          <Button className='w-full' disabled={submitting} onClick={handleSave}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegistrationCashDialog({ userId, packageId }: { userId: Id<"users">; packageId: string }) {
  const markRegistrationPaidCash = useAction(api.registration.markRegistrationPaidCash);
  const packages = usePackagesLookup();
  const requiredFee = packages[packageId]?.regFee ?? 0;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await markRegistrationPaidCash({ userId, amountPaid: requiredFee });
      if (result.status === "duplicate") {
        toast.error("Registration fee was already marked paid.");
      } else {
        toast.success("Registration fee marked paid (cash).");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to mark registration fee paid.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-8">
          Mark Registration Fee Paid (Cash)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Registration Fee Paid (Cash)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            Registration fee for this package: <span className="font-semibold">{fmt(requiredFee)}</span>
          </p>
          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Recording…" : "Mark Paid"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserDetail({ userId, role }: { userId: Id<"users">; role: string | undefined }) {
  const detail = useQuery(api.admin.getUserDetail, { userId });
  const clearLoan = useMutation(api.admin.clearLoan);
  const approveLoan = useMutation(api.admin.approveLoan);
  const disburseLoan = useMutation(api.admin.disburseLoan);
  const deleteCashContribution = useMutation(api.adminContributions.deleteCashContribution);
  const [loading, setLoading] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const canFinancial = role === "finance-admin" || role === "super-admin";
  const canAssist = role === "assist-admin" || role === "super-admin";
  const packages = usePackagesLookup();

  if (!detail) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
    </div>
  );

  const { user, userData, contributions, loans } = detail;

  const successContribs = contributions.filter((c) => c.status === "success");
  const uniqueDates = new Set(successContribs.flatMap((c) => c.coveredDates));
  const daysContributed = uniqueDates.size;
  const totalSaved = successContribs.reduce((s, c) => s + c.amount, 0);
  const pkg = user.selectedPackage ? packages[user.selectedPackage] : null;
  const durationDays = pkg?.durationDays ?? 90;

  async function handleDeleteCashContribution(contributionId: Id<"userContributions">) {
    if (!window.confirm("Remove this cash contribution? This cannot be undone.")) return;
    setLoading(`delete-contribution-${contributionId}`);
    try {
      await deleteCashContribution({ contributionId });
      toast.success("Contribution removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove contribution.");
    } finally {
      setLoading(null);
    }
  }

  async function handleLoanAction(action: "approve" | "disburse" | "clear", loanId: Id<"userLoans">) {
    setLoading(`${action}-${loanId}`);
    try {
      if (action === "approve") await approveLoan({ loanId });
      else if (action === "disburse") await disburseLoan({ loanId });
      else await clearLoan({ loanId });
      toast.success(`Loan ${action}d successfully.`);
    } catch {
      toast.error("Action failed. Try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className='space-y-6 pr-1'>
      {/* Registration status */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
        user.registrationPaid
          ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
          : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
      }`}>
        <div>
          <p className="text-xs text-muted-foreground">Registration fee</p>
          <p className={`text-sm font-semibold ${user.registrationPaid ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {user.registrationPaid ? "Paid ✓" : "Pending"}
          </p>
          {user.registrationPaidAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(user.registrationPaidAt).toLocaleDateString("en-NG")}
              {user.registrationPaymentMethod === "cash" &&
                ` · Cash (recorded by ${user.registrationRecordedBy ?? "admin"})`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ref code</p>
          <p className="text-xs font-mono font-medium">{user.registrationRef ?? "—"}</p>
        </div>
      </div>

      {canAssist && (
        <div className="flex justify-end gap-2 flex-wrap">
          {!user.registrationPaid && user.selectedPackage && (
            <RegistrationCashDialog userId={userId} packageId={user.selectedPackage} />
          )}
          {user.selectedPackage && user.registrationPaid && user.registrationPaidAt && (
            <CashContributionDialog
              userId={userId}
              packageId={user.selectedPackage}
              alreadyCoveredDates={[...uniqueDates]}
              registrationPaidAt={user.registrationPaidAt}
            />
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className='grid grid-cols-2 gap-3'>
        {[
          {
            label: "Days contributed",
            value: `${daysContributed}/${durationDays}`,
            icon: CheckCircle2,
          },
          { label: "Total saved", value: fmt(totalSaved), icon: Wallet },
          { label: "Package", value: pkg?.name ?? "None", icon: TrendingUp },
          {
            label: "Loan eligible",
            value: daysContributed >= durationDays ? "Yes ✓" : "No",
            icon: Clock,
          },
        ].map((s) => (
          <div key={s.label} className='rounded-xl bg-muted/40 p-3'>
            <div className='flex items-center gap-1.5 mb-1'>
              <s.icon className='h-3.5 w-3.5 text-muted-foreground' />
              <span className='text-xs text-muted-foreground'>{s.label}</span>
            </div>
            <p className='text-sm font-bold'>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Profile — collapsible (includes onboarding data) */}

      <div className='rounded-xl border border-border overflow-hidden'>
        <button
          type='button'
          onClick={() => setProfileOpen((o) => !o)}
          className='w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors'>
          Personal Information
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
          />
        </button>
        {profileOpen && (
          <div className='px-4 pb-4 pt-3 space-y-4 border-t border-border'>
            {/* Onboarding data */}
            {userData ? (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                {[
                  ["Full name", userData.fullName],
                  ["Email", user.email],
                  ["Phone", userData.mobilePhoneNumber],
                  ["Gender", userData.gender],
                  ["Marital Status", userData.maritalStatus],
                  ["DOB", userData.dateOfBirth],
                  ["Nationality", userData.nationality],
                  ["State", userData.stateOfOrigin],
                  ["LGA", userData.lga],
                  ["Home Town", userData.homeTown],
                  ["Nickname", userData.nickName],
                  ["Mother Maiden Name", userData.motherMaidenName],
                  ["Means of ID", userData.meansOfIdentification],
                  ["ID Start", userData.meansOfIdentificationStartDate],
                  ["ID Expiry", userData.meansOfIdentificationExpiryDate],
                  ["Educational Background", userData.educationalBackground],
                  ["NOK First Name", userData.nokFirstName],
                  ["NOK Surname", userData.nokSurname],
                  ["NOK DOB", userData.nokDateOfBirth],
                  ["NOK Email", userData.nokEmail],
                  ["NOK Gender", userData.nokGender],
                  ["NOK Relationship", userData.nokRelationship],
                  ["NOK Phone", userData.nokPhoneNumber],
                  ["NOK House Address", userData.nokHouseAddress],

                  [
                    "Account",
                    `${userData.bankName} — ${userData.accountNumber}`,
                  ],
                  ["Account name", userData.accountName],
                  ["BVN", `****${userData.bvn.slice(-3)}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className='text-muted-foreground'>{k}:</span>{" "}
                    <span className='font-medium break-all'>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                No onboarding data yet.
              </p>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Contributions */}
      <div>
        <h3 className='text-sm font-semibold mb-3'>
          Contributions ({contributions.length})
        </h3>
        {contributions.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No contributions yet.</p>
        ) : (
          <div className='space-y-2 max-h-36 overflow-y-auto'>
            {contributions.map((c) => (
              <div
                key={c._id}
                className='flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0'>
                <div>
                  <p className='font-medium'>{fmt(c.amount)}</p>
                  <p className='text-xs text-muted-foreground'>
                    {c.daysCount} day{c.daysCount !== 1 ? "s" : ""} ·{" "}
                    {new Date(c._creationTime).toLocaleDateString("en-NG")}
                    {c.paymentMethod === "cash" &&
                      ` · Cash (recorded by ${c.recordedBy ?? "admin"})`}
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge
                    className={`text-xs border-transparent ${c.status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                    {c.status}
                  </Badge>
                  {canAssist && c.paymentMethod === "cash" && (
                    <>
                      {c.coveredDates.length > 1 && (
                        <EditCashDatesDialog contributionId={c._id} coveredDates={c.coveredDates} />
                      )}
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
                        disabled={loading === `delete-contribution-${c._id}`}
                        onClick={() => handleDeleteCashContribution(c._id)}>
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Loans */}
      <div>
        <h3 className='text-sm font-semibold mb-3'>Loans ({loans.length})</h3>
        {loans.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No loan applications.</p>
        ) : (
          <div className='space-y-3'>
            {loans.map((loan) => (
              <div
                key={loan._id}
                className='rounded-xl border border-border p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <div>
                    <p className='text-sm font-semibold'>{fmt(loan.amount)}</p>
                    <p className='text-xs text-muted-foreground capitalize'>
                      {packages[loan.packageId]?.name ?? loan.packageId} Package
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Applied {new Date(loan.appliedAt).toLocaleDateString("en-NG")}
                    </p>
                    {loan.approvedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Approved {new Date(loan.approvedAt).toLocaleDateString("en-NG")}
                      </p>
                    )}
                    {loan.disbursedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Disbursed {new Date(loan.disbursedAt).toLocaleDateString("en-NG")}
                      </p>
                    )}
                    {loan.clearedAt && (
                      <p className='text-xs text-muted-foreground'>
                        Cleared {new Date(loan.clearedAt).toLocaleDateString("en-NG")}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`text-xs border-transparent capitalize ${
                      loan.status === "cleared"
                        ? "bg-muted text-muted-foreground"
                        : loan.status === "disbursed"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : loan.status === "approved"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                    }`}>
                    {loan.status}
                  </Badge>
                </div>
                <div className='flex gap-2 flex-wrap'>
                  {canFinancial && loan.status === "pending" && (
                    <Button
                      size='sm'
                      className='bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8'
                      disabled={loading === `approve-${loan._id}`}
                      onClick={() => handleLoanAction("approve", loan._id)}>
                      {loading === `approve-${loan._id}` ? "…" : "Approve"}
                    </Button>
                  )}
                  {canFinancial && loan.status === "approved" && (
                    <Button
                      size='sm'
                      className='bg-blue-600 hover:bg-blue-700 text-white text-xs h-8'
                      disabled={loading === `disburse-${loan._id}`}
                      onClick={() => handleLoanAction("disburse", loan._id)}>
                      {loading === `disburse-${loan._id}`
                        ? "…"
                        : "Mark Disbursed"}
                    </Button>
                  )}
                  {canFinancial && loan.status === "disbursed" && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='text-xs h-8'
                      disabled={loading === `clear-${loan._id}`}
                      onClick={() => handleLoanAction("clear", loan._id)}>
                      {loading === `clear-${loan._id}`
                        ? "…"
                        : "Mark Repaid & Clear"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function StatSpinner() {
  return <div className="h-6 w-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />;
}

// ── Content management (content-admin) ──────────────────────────────────

type HeroContent = { badge: string; headline: string; subtext: string; bullets: string[] };
type StepContent = { step: string; title: string; desc: string };
type FeatureContent = { title: string; desc: string };
type FaqContent = { q: string; a: string };

const DEFAULT_CONTENT = {
  hero: {
    badge: "Registered Cooperative Society · Nigeria",
    headline: "Save Daily. Build Wealth. Access Loans.",
    subtext:
      "Heritage Multipurpose Cooperative helps you develop a consistent savings habit and rewards you with loan access after 90 days of contribution.",
    bullets: ["No hidden charges", "Secure payments", "90-day loan access"],
  } as HeroContent,
  "how-it-works": [
    { step: "01", title: "Create Account", desc: "Sign up and complete your KYC onboarding in minutes. Your data is secured and encrypted." },
    { step: "02", title: "Choose a Package", desc: "Select from 5 packages (Bronze to Emerald) based on your daily savings capacity." },
    { step: "03", title: "Save & Unlock Loan", desc: "Contribute your daily amount for 90 days to unlock your loan entitlement." },
  ] as StepContent[],
  "why-us": [
    { title: "Legally Registered", desc: "Registered under Nigerian cooperative law. Your contributions are protected." },
    { title: "Flexible Loan Access", desc: "Unlock loans up to ₦2,000,000 based on your package after 90 days." },
    { title: "Track Your Progress", desc: "Real-time dashboard showing contribution days, total saved, and loan eligibility." },
    { title: "No Collateral", desc: "Access cooperative loans without physical collateral — your contribution record is enough." },
    { title: "Community Driven", desc: "A cooperative model where members support each other's financial growth." },
    { title: "Secure Payments", desc: "All transactions processed via Squadco — PCI-DSS compliant payment infrastructure." },
  ] as FeatureContent[],
  faq: [
    { q: "How does Heritage Cooperative work?", a: "You select a savings package, contribute your daily amount for 90 consecutive days, and then become eligible to access a loan equal to your package's entitlement." },
    { q: "Can I change my package after selecting one?", a: "Yes — you can switch packages at any time before applying for a loan. Your existing contribution days are preserved; only the daily amount and loan entitlement change. Package changes are locked once a loan application is pending or approved." },
    { q: "How is the loan amount determined?", a: "Each package has a fixed loan entitlement. After completing 90 days of contributions, you can apply for up to your package's maximum loan amount." },
    { q: "What payment methods are supported?", a: "We accept all major Nigerian cards, bank transfers, and USSD payments through our secure Squadco payment gateway." },
    { q: "How long does loan approval take?", a: "Loan applications are reviewed within 3–5 business days after submission. You will be notified via your registered email." },
    { q: "Is my money safe?", a: "Heritage Multipurpose Cooperative Society is a registered cooperative operating under Nigerian cooperative law. All payments are processed via PCI-DSS compliant Squadco infrastructure." },
  ] as FaqContent[],
};

function HeroEditor({
  value,
  onSave,
  onSaved,
}: {
  value: HeroContent;
  onSave: (v: HeroContent) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [badge, setBadge] = useState(value.badge);
  const [headline, setHeadline] = useState(value.headline);
  const [subtext, setSubtext] = useState(value.subtext);
  const [bullets, setBullets] = useState(value.bullets.join("\n"));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        badge,
        headline,
        subtext,
        bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      });
      toast.success("Hero section updated.");
      onSaved();
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1.5 block">Badge text</Label>
        <Input value={badge} onChange={(e) => setBadge(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Headline</Label>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Subtext</Label>
        <Textarea value={subtext} onChange={(e) => setSubtext(e.target.value)} rows={3} />
      </div>
      <div>
        <Label className="text-xs mb-1.5 block">Checklist bullets (one per line)</Label>
        <Textarea value={bullets} onChange={(e) => setBullets(e.target.value)} rows={3} />
      </div>
      <Button className="w-full" disabled={saving} onClick={handleSave}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function ListEditor<T extends Record<string, string>>({
  value,
  fields,
  emptyItem,
  onSave,
  onSaved,
}: {
  value: T[];
  fields: { key: keyof T; label: string; multiline?: boolean }[];
  emptyItem: T;
  onSave: (v: T[]) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<T[]>(value);
  const [saving, setSaving] = useState(false);

  function updateItem(i: number, key: keyof T, val: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(items);
      toast.success("Section updated.");
      onSaved();
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-border p-3 space-y-2 relative">
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute top-2 right-2 text-muted-foreground hover:text-red-600"
              aria-label="Remove item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {fields.map((f) => (
              <div key={String(f.key)}>
                <Label className="text-xs mb-1 block">{f.label}</Label>
                {f.multiline ? (
                  <Textarea
                    value={item[f.key] ?? ""}
                    onChange={(e) => updateItem(i, f.key, e.target.value)}
                    rows={2}
                  />
                ) : (
                  <Input
                    value={item[f.key] ?? ""}
                    onChange={(e) => updateItem(i, f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>
        <Plus className="h-3.5 w-3.5" /> Add item
      </Button>
      <Button className="w-full" disabled={saving} onClick={handleSave}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function ContentSectionDialog({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

type PackageRow = {
  packageId: string;
  name: string;
  desc: string;
  daily: number;
  loanMax: number;
  regFee: number;
  durationDays: number;
  popular?: boolean;
  order: number;
};

function PackageEditorCard({ pkg, onSave }: { pkg: PackageRow; onSave: (v: PackageRow) => Promise<unknown> }) {
  const [form, setForm] = useState(pkg);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PackageRow>(key: K, value: PackageRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      toast.success(`${form.name || form.packageId} package updated.`);
    } catch {
      toast.error("Failed to save package.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Package ID</Label>
          <Input value={form.packageId} onChange={(e) => set("packageId", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Display name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Textarea value={form.desc} onChange={(e) => set("desc", e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Daily contribution (₦)</Label>
          <Input type="number" value={form.daily} onChange={(e) => set("daily", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Loan maximum (₦)</Label>
          <Input type="number" value={form.loanMax} onChange={(e) => set("loanMax", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Registration fee (₦)</Label>
          <Input type="number" value={form.regFee} onChange={(e) => set("regFee", Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Duration (days)</Label>
          <Input type="number" value={form.durationDays} onChange={(e) => set("durationDays", Number(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.popular}
              onChange={(e) => set("popular", e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-600"
            />
            Mark as &quot;Most Popular&quot;
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            Display order
            <Input
              type="number"
              value={form.order}
              onChange={(e) => set("order", Number(e.target.value))}
              className="w-16 h-7"
            />
          </label>
        </div>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function PackagesAdminPanel() {
  const packages = useQuery(api.packages.list);
  const upsert = useMutation(api.packages.upsert);
  const seedDefaults = useMutation(api.packages.seedDefaults);
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedDefaults({});
      toast.success("Default packages created.");
    } catch {
      toast.error("Failed to seed default packages.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <h2 className="font-semibold">Package Details</h2>
        <p className="text-sm text-muted-foreground">
          Manage each package&apos;s name, description, daily contribution, loan maximum,
          registration fee, and duration. Changes apply everywhere these are shown.
        </p>
      </div>

      {packages === undefined ? (
        <div className="flex items-center justify-center py-16">
          <StatSpinner />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-12 px-6">
          <p className="text-sm text-muted-foreground mb-4">No packages configured yet.</p>
          <Button disabled={seeding} onClick={handleSeed}>
            {seeding ? "Seeding…" : "Seed default packages"}
          </Button>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-3">
          {[...packages].sort((a, b) => a.order - b.order).map((p) => (
            <PackageEditorCard
              key={p._id}
              pkg={{
                packageId: p.packageId,
                name: p.name,
                desc: p.desc,
                daily: p.daily,
                loanMax: p.loanMax,
                regFee: p.regFee,
                durationDays: p.durationDays,
                popular: p.popular,
                order: p.order,
              }}
              onSave={(v) => upsert(v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentAdminPanel() {
  const content = useQuery(api.content.getAll);
  const upsertSection = useMutation(api.content.upsertSection);

  if (content === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <StatSpinner />
      </div>
    );
  }

  const hero = (content.hero as HeroContent | undefined) ?? DEFAULT_CONTENT.hero;
  const howItWorks = (content["how-it-works"] as StepContent[] | undefined) ?? DEFAULT_CONTENT["how-it-works"];
  const whyUs = (content["why-us"] as FeatureContent[] | undefined) ?? DEFAULT_CONTENT["why-us"];
  const faq = (content.faq as FaqContent[] | undefined) ?? DEFAULT_CONTENT.faq;

  const sections = [
    {
      key: "hero",
      title: "Hero section",
      description: "Badge, headline, subtext and checklist bullets shown at the top of the homepage.",
      node: (close: () => void) => (
        <HeroEditor value={hero} onSave={(v) => upsertSection({ key: "hero", data: v })} onSaved={close} />
      ),
    },
    {
      key: "how-it-works",
      title: "How It Works",
      description: "The 3-step process shown on the homepage.",
      node: (close: () => void) => (
        <ListEditor
          value={howItWorks}
          fields={[
            { key: "step", label: "Step number" },
            { key: "title", label: "Title" },
            { key: "desc", label: "Description", multiline: true },
          ]}
          emptyItem={{ step: "0" + (howItWorks.length + 1), title: "", desc: "" }}
          onSave={(v) => upsertSection({ key: "how-it-works", data: v })}
          onSaved={close}
        />
      ),
    },
    {
      key: "why-us",
      title: "Why Heritage Cooperative",
      description: "Feature cards explaining why members should join.",
      node: (close: () => void) => (
        <ListEditor
          value={whyUs}
          fields={[
            { key: "title", label: "Title" },
            { key: "desc", label: "Description", multiline: true },
          ]}
          emptyItem={{ title: "", desc: "" }}
          onSave={(v) => upsertSection({ key: "why-us", data: v })}
          onSaved={close}
        />
      ),
    },
    {
      key: "faq",
      title: "FAQ",
      description: "Frequently asked questions shown on the homepage.",
      node: (close: () => void) => (
        <ListEditor
          value={faq}
          fields={[
            { key: "q", label: "Question" },
            { key: "a", label: "Answer", multiline: true },
          ]}
          emptyItem={{ q: "", a: "" }}
          onSave={(v) => upsertSection({ key: "faq", data: v })}
          onSaved={close}
        />
      ),
    },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <h2 className="font-semibold">Landing Page Content</h2>
        <p className="text-sm text-muted-foreground">Edit the copy shown on the public homepage.</p>
      </div>
      <div className="divide-y divide-border">
        {sections.map((s) => (
          <div key={s.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <ContentSectionDialog label={s.title}>{s.node}</ContentSectionDialog>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Financial reports (finance-admin) ────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toIsoDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ReportPreviewDialog<T extends Record<string, unknown>>({
  title,
  rows,
  getDate,
  columns,
  filenamePrefix,
}: {
  title: string;
  rows: T[];
  getDate: (row: T) => Date | undefined;
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
  filenamePrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const startDate = range?.from ? toIsoDate(range.from) : "";
  const endDate = range?.to ? toIsoDate(range.to) : "";
  const startMs = range?.from ? new Date(range.from.setHours(0, 0, 0, 0)).getTime() : undefined;
  const endMs = range?.to ? new Date(range.to.setHours(23, 59, 59, 999)).getTime() : undefined;

  const filteredRows = rows.filter((row) => {
    if (startMs === undefined && endMs === undefined) return true;
    const d = getDate(row);
    if (!d) return false;
    const t = d.getTime();
    return (startMs === undefined || t >= startMs) && (endMs === undefined || t <= endMs);
  });

  const rangeLabel = startDate || endDate ? `${startDate || "…"} to ${endDate || "…"}` : "All time";
  const filename = `${filenamePrefix}-${startDate || "all"}-to-${endDate || "all"}.csv`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 w-full sm:w-auto"
          disabled={rows.length === 0}
        >
          Preview {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Field className="w-full sm:w-auto">
          <FieldLabel htmlFor={`${filenamePrefix}-range`} className="sr-only">
            Date range
          </FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id={`${filenamePrefix}-range`}
                className="justify-start px-2.5 font-normal w-full sm:w-auto"
              >
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                {range?.from ? (
                  range.to ? (
                    <>
                      {format(range.from, "LLL dd, y")} - {format(range.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(range.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                defaultMonth={range?.from}
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </Field>
        <p className="text-xs text-muted-foreground">
          {rangeLabel} · {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}
        </p>
        <div className="overflow-auto flex-1 rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="text-left font-medium px-3 py-2 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      {c.render ? c.render(row) : String(row[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          size="sm"
          className="gap-1.5 self-end"
          onClick={() => downloadCsv(filename, filteredRows)}
          disabled={filteredRows.length === 0}
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function FinanceReports() {
  const summary = useQuery(api.reports.getFinancialSummary, {});

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <h2 className="font-semibold">Financial Reports</h2>
        <p className="text-sm text-muted-foreground">
          All-time contribution & loan totals. Pick a date range inside each preview to filter what gets exported.
        </p>
      </div>

      {!summary ? (
        <div className="flex items-center justify-center py-16">
          <StatSpinner />
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Contributed", value: fmt(summary.totalContributed) },
              { label: "Contributions", value: String(summary.contributionCount) },
              { label: "Total Registration Fees", value: fmt(summary.totalRegistrationFees) },
              { label: "Registrations", value: String(summary.registrationCount) },
              { label: "Total Disbursed", value: fmt(summary.totalDisbursed) },
              {
                label: "Loans (pending/approved/disbursed/cleared)",
                value: `${summary.loansByStatus.pending ?? 0}/${summary.loansByStatus.approved ?? 0}/${summary.loansByStatus.disbursed ?? 0}/${summary.loansByStatus.cleared ?? 0}`,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <ReportPreviewDialog
              title="Contributions"
              rows={summary.contributions.map((c) => ({
                memberName: c.memberName,
                userId: c.userId,
                amount: c.amount,
                daysCount: c.daysCount,
                status: c.status,
                paymentMethod: c.paymentMethod ?? "online",
                date: new Date(c._creationTime).toISOString(),
              }))}
              getDate={(r) => (r.date ? new Date(r.date as string) : undefined)}
              columns={[
                { key: "memberName", label: "Member" },
                { key: "amount", label: "Amount", render: (r) => fmt(r.amount as number) },
                { key: "daysCount", label: "Days" },
                { key: "status", label: "Status" },
                { key: "paymentMethod", label: "Method" },
                {
                  key: "date",
                  label: "Date",
                  render: (r) => new Date(r.date as string).toLocaleDateString("en-NG"),
                },
              ]}
              filenamePrefix="contributions"
            />
            <ReportPreviewDialog
              title="Registrations"
              rows={summary.registrations.map((r) => ({
                memberName: r.memberName,
                userId: r.userId,
                amount: r.amount,
                paymentMethod: r.paymentMethod ?? "online",
                recordedBy: r.recordedBy ?? "",
                date: r.paidAt ? new Date(r.paidAt).toISOString() : "",
              }))}
              getDate={(r) => (r.date ? new Date(r.date as string) : undefined)}
              columns={[
                { key: "memberName", label: "Member" },
                { key: "amount", label: "Amount", render: (r) => fmt(r.amount as number) },
                { key: "paymentMethod", label: "Method" },
                { key: "recordedBy", label: "Recorded By" },
                {
                  key: "date",
                  label: "Date",
                  render: (r) => (r.date ? new Date(r.date as string).toLocaleDateString("en-NG") : "—"),
                },
              ]}
              filenamePrefix="registrations"
            />
            <ReportPreviewDialog
              title="Loans"
              rows={summary.loans.map((l) => ({
                memberName: l.memberName,
                userId: l.userId,
                amount: l.amount,
                packageId: l.packageId,
                status: l.status,
                appliedAt: new Date(l.appliedAt).toISOString(),
              }))}
              getDate={(r) => (r.appliedAt ? new Date(r.appliedAt as string) : undefined)}
              columns={[
                { key: "memberName", label: "Member" },
                { key: "amount", label: "Amount", render: (r) => fmt(r.amount as number) },
                { key: "packageId", label: "Package" },
                { key: "status", label: "Status" },
                {
                  key: "appliedAt",
                  label: "Applied",
                  render: (r) => new Date(r.appliedAt as string).toLocaleDateString("en-NG"),
                },
              ]}
              filenamePrefix="loans"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared members table + detail sheet (assist-admin & finance-admin) ───

function MembersSection({ role }: { role: string | undefined }) {
  const { isAuthenticated } = useConvexAuth();
  const allUsers = useQuery(api.admin.getAllUsers, isAuthenticated ? {} : "skip");
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  return (
    <>
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">All Members</h2>
            <p className="text-sm text-muted-foreground">{allUsers?.length ?? 0} registered users</p>
          </div>
        </div>

        {!allUsers ? (
          <div className="flex items-center justify-center py-16">
            <StatSpinner />
          </div>
        ) : allUsers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No members yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allUsers.map((u) => (
              <div key={u._id} className="flex items-center gap-2 px-4 sm:px-6 py-4">
                <motion.button
                  type="button"
                  whileHover={{ backgroundColor: "var(--muted)" }}
                  onClick={() => setSelectedUserId(u._id)}
                  className="w-full min-w-0 flex flex-col sm:flex-row gap-y-2 justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {u.registeredByAdmin && (
                      <Badge variant="outline" className="text-xs">Walk-in</Badge>
                    )}
                    {u.selectedPackage && (
                      <Badge variant="outline" className="text-xs capitalize border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                        {u.selectedPackage}
                      </Badge>
                    )}
                    {u.isOnboarded ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent">
                        Onboarded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                    )}
                  </div>
                </motion.button>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedUserId} onOpenChange={(open) => { if (!open) setSelectedUserId(null); }}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg overflow-y-auto px-4 pt-4 pb-6"
        >
          <SheetHeader className="mb-4">
            <SheetTitle>
              {allUsers?.find((u) => u._id === selectedUserId)?.name ?? "Member"} — Detail
            </SheetTitle>
          </SheetHeader>
          {selectedUserId && <UserDetail userId={selectedUserId} role={role} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function AdminPage() {
  const { user: clerkUser } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const role = clerkUser?.publicMetadata?.role as string | undefined;
  const isContent = role === "content-admin" || role === "super-admin";
  const isAssist = role === "assist-admin" || role === "super-admin";
  const isFinance = role === "finance-admin" || role === "super-admin";

  const allUsers = useQuery(api.admin.getAllUsers, isAuthenticated ? {} : "skip");
  const totalSavedData = useQuery(api.admin.getTotalSaved, isAuthenticated && isFinance ? {} : "skip");

  const availableTabs = [
    isContent && { value: "content", label: "Content" },
    isAssist && { value: "assist", label: "Assist" },
    isFinance && { value: "finance", label: "Finance" },
  ].filter(Boolean) as { value: string; label: string }[];

  const onboardedCount = (allUsers ?? []).filter((u) => u.isOnboarded).length;

  if (availableTabs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">You do not have access to any admin section.</p>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-muted/30'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className='flex flex-col gap-4'>
          <Link href='/dashboard'>
            <Button variant='outline' size='sm' className='gap-1.5'>
              <ArrowLeft className='h-3.5 w-3.5' /> Dashboard
            </Button>
          </Link>
          <div>
            <div className='flex items-center gap-2'>
              <Shield className='h-5 w-5 text-emerald-600' />
              <h1 className='text-xl font-bold'>Admin Panel</h1>
            </div>
            <p className='text-sm text-muted-foreground'>
              Heritage Cooperative · Admin Dashboard
            </p>
          </div>
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {[
            {
              label: "Total Members",
              value: allUsers == null ? null : allUsers.length,
              icon: Users,
            },
            {
              label: "Onboarded",
              value: allUsers == null ? null : onboardedCount,
              icon: CheckCircle2,
            },
            {
              label: "Active Packages",
              value:
                allUsers == null
                  ? null
                  : allUsers.filter((u) => u.selectedPackage).length,
              icon: TrendingUp,
            },
            ...(isFinance
              ? [
                  {
                    label: "Total Contributed",
                    value: totalSavedData == null ? null : fmt(totalSavedData),
                    icon: Wallet,
                  },
                ]
              : []),
          ].map((s) => (
            <div
              key={s.label}
              className='rounded-2xl bg-card border border-border p-5 shadow-sm'>
              <div className='flex items-center gap-2 mb-2'>
                <s.icon className='h-4 w-4 text-emerald-600' />
                <span className='text-xs text-muted-foreground'>{s.label}</span>
              </div>
              {s.value === null ? (
                <StatSpinner />
              ) : (
                <p className='text-2xl font-bold'>{s.value}</p>
              )}
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue={availableTabs[0].value} className='flex-col'>
          <TabsList
            className='grid w-full sm:inline-flex sm:w-fit'
            style={{
              gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))`,
            }}>
            {availableTabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className='sm:flex-none'>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {isContent && (
            <TabsContent value='content' className='mt-4 space-y-6'>
              <ContentAdminPanel />
              <PackagesAdminPanel />
            </TabsContent>
          )}

          {isAssist && (
            <TabsContent value='assist' className='mt-4 space-y-6'>
              <MembersSection role={role} />
            </TabsContent>
          )}

          {isFinance && (
            <TabsContent value='finance' className='mt-4 space-y-6'>
              <FinanceReports />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

