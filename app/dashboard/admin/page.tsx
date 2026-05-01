"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const PACKAGES: Record<string, { name: string; daily: number; loan: number }> = {
  bronze:  { name: "Bronze",  daily: 500,    loan: 100_000 },
  silver:  { name: "Silver",  daily: 1_000,  loan: 180_000 },
  gold:    { name: "Gold",    daily: 2_000,  loan: 360_000 },
  diamond: { name: "Diamond", daily: 5_000,  loan: 1_000_000 },
  emerald: { name: "Emerald", daily: 10_000, loan: 2_000_000 },
};

function fmt(n: number) { return `₦${n.toLocaleString("en-NG")}`; }

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) router.replace("/sign-in");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (clerkLoaded && isAuthenticated && user?.publicMetadata?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [clerkLoaded, isAuthenticated, user, router]);

  if (isLoading || !clerkLoaded) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!isAuthenticated || user?.publicMetadata?.role !== "admin") return null;

  return <>{children}</>;
}

function UserDetail({ userId, onClose }: { userId: Id<"users">; onClose: () => void }) {
  const detail = useQuery(api.admin.getUserDetail, { userId });
  const clearLoan = useMutation(api.admin.clearLoan);
  const approveLoan = useMutation(api.admin.approveLoan);
  const disburseLoan = useMutation(api.admin.disburseLoan);
  const [loading, setLoading] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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
  const pkg = user.selectedPackage ? PACKAGES[user.selectedPackage] : null;

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
      {/* Summary stats */}
      <div className='grid grid-cols-2 gap-3'>
        {[
          {
            label: "Days contributed",
            value: `${daysContributed}/90`,
            icon: CheckCircle2,
          },
          { label: "Total saved", value: fmt(totalSaved), icon: Wallet },
          { label: "Package", value: pkg?.name ?? "None", icon: TrendingUp },
          {
            label: "Loan eligible",
            value: daysContributed >= 90 ? "Yes ✓" : "No",
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
              <div className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                {[
                  ["Full name", userData.fullName],
                  ["Email", user.email],
                  ["Phone", userData.mobilePhoneNumber],
                  ["Gender", userData.gender],
                  ["State", userData.stateOfOrigin],
                  ["LGA", userData.lga],
                  ["Home Town", userData.homeTown],
                  ["DOB", userData.dateOfBirth],
                  ["Gender", userData.gender],
                  ["Marital Status", userData.maritalStatus],
                  ["Means of ID", userData.meansOfIdentification],
                  ["ID Start", userData.meansOfIdentificationStartDate],
                  ["ID Expiry", userData.meansOfIdentificationExpiryDate],
                  ["Educational Background", userData.educationalBackground],
                  ["Phone", userData.mobilePhoneNumber],
                  ["Mother Maiden Name", userData.motherMaidenName],
                  ["Nationality", userData.nationality],
                  ["Nickname", userData.nickName],
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
                  </p>
                </div>
                <Badge
                  className={`text-xs border-transparent ${c.status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                  {c.status}
                </Badge>
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
                      {PACKAGES[loan.packageId]?.name ?? loan.packageId} ·{" "}
                      {new Date(loan.appliedAt).toLocaleDateString("en-NG")}
                    </p>
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
                  {loan.status === "pending" && (
                    <Button
                      size='sm'
                      className='bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8'
                      disabled={loading === `approve-${loan._id}`}
                      onClick={() => handleLoanAction("approve", loan._id)}>
                      {loading === `approve-${loan._id}` ? "…" : "Approve"}
                    </Button>
                  )}
                  {loan.status === "approved" && (
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
                  {loan.status === "disbursed" && (
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

export default function AdminPage() {
  const allUsers = useQuery(api.admin.getAllUsers);
  const totalSavedData = useQuery(api.admin.getTotalSaved);
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  const onboardedCount = (allUsers ?? []).filter((u) => u.isOnboarded).length;

  return (
    <AdminGuard>
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
                Heritage Cooperative · Member Management
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
                value: allUsers == null ? null : allUsers.filter((u) => u.selectedPackage).length,
                icon: TrendingUp,
              },
              {
                label: "Total Saved",
                value: totalSavedData == null ? null : fmt(totalSavedData),
                icon: Wallet,
              },
            ].map((s) => (
              <div
                key={s.label}
                className='rounded-2xl bg-card border border-border p-5 shadow-sm'>
                <div className='flex items-center gap-2 mb-2'>
                  <s.icon className='h-4 w-4 text-emerald-600' />
                  <span className='text-xs text-muted-foreground'>
                    {s.label}
                  </span>
                </div>
                {s.value === null ? (
                  <StatSpinner />
                ) : (
                  <p className='text-2xl font-bold'>{s.value}</p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Members table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className='rounded-2xl bg-card border border-border shadow-sm overflow-hidden'>
            <div className='px-6 py-4 border-b border-border'>
              <h2 className='font-semibold'>All Members</h2>
              <p className='text-sm text-muted-foreground'>
                {allUsers?.length ?? 0} registered users
              </p>
            </div>

            {!allUsers ? (
              <div className='flex items-center justify-center py-16'>
                <div className='h-6 w-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin' />
              </div>
            ) : allUsers.length === 0 ? (
              <div className='text-center py-16 text-muted-foreground'>
                <Users className='h-8 w-8 mx-auto mb-2 opacity-50' />
                <p className='text-sm'>No members yet.</p>
              </div>
            ) : (
              <div className='divide-y divide-border'>
                {allUsers.map((u) => (
                  <div key={u._id} className='flex items-center px-6 py-4'>
                    <motion.button
                      type='button'
                      whileHover={{ backgroundColor: "var(--muted)" }}
                      onClick={() => setSelectedUserId(u._id)}
                      className='w-full flex flex-col sm:flex-row gap-y-2 justify-between  text-left transition-colors'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <div className='h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0'>
                          <span className='text-sm font-bold text-emerald-700 dark:text-emerald-400'>
                            {(u.name || u.email || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className='min-w-0'>
                          <p className='text-sm font-medium truncate'>
                            {u.name || "—"}
                          </p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {u.email}
                          </p>
                        </div>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        {u.selectedPackage && (
                          <Badge
                            variant='outline'
                            className='text-xs capitalize border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'>
                            {u.selectedPackage}
                          </Badge>
                        )}
                        {u.isOnboarded ? (
                          <Badge className='text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent'>
                            Onboarded
                          </Badge>
                        ) : (
                          <Badge
                            variant='outline'
                            className='text-xs text-muted-foreground'>
                            Pending
                          </Badge>
                        )}
                   
                      </div>
                    </motion.button>
                    <ChevronRight className='h-4 w-4 ml-6 text-muted-foreground' />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* User detail sheet */}
      <Sheet
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}>
        <SheetContent
          side='right'
          className='data-[side=right]:w-full data-[side=right]:sm:max-w-lg overflow-y-auto px-4 pt-4 pb-6'>
          <SheetHeader className='mb-4'>
            <SheetTitle>
              {allUsers?.find((u) => u._id === selectedUserId)?.name ??
                "Member"}{" "}
              — Detail
            </SheetTitle>
          </SheetHeader>
          {selectedUserId && (
            <UserDetail
              userId={selectedUserId}
              onClose={() => setSelectedUserId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </AdminGuard>
  );
}

