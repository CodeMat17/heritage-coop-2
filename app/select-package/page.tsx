"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Building2 } from "lucide-react";

function fmt(n: number) {
  return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(0)}M` : `₦${n.toLocaleString("en-NG")}`;
}

export default function SelectPackagePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.current);
  const packages = useQuery(api.packages.list);
  const selectPackage = useMutation(api.users.selectPackage);
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user === undefined || user === null) return;
    if (!user.isOnboarded) router.replace("/onboarding");
    else if (user.registrationPaid) router.replace("/dashboard");
    else if (user.selectedPackage && !user.registrationPaid) router.replace("/payment-instructions");
  }, [user, router]);

  async function handleConfirm() {
    if (!selected) { toast.error("Please select a package."); return; }
    setSaving(true);
    try {
      await selectPackage({ packageId: selected });
      router.push("/payment-instructions");
    } catch {
      toast.error("Failed to save package. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const PACKAGES = (packages ?? []).map((p) => ({
    id: p.packageId,
    name: p.name,
    daily: p.daily,
    loan: p.loanMax,
    regFee: p.regFee,
    desc: p.desc,
    popular: p.popular,
    durationDays: p.durationDays,
    flexibleDaily: p.flexibleDaily,
    interestRatePercent: p.interestRatePercent,
    interestUnlockDays: p.interestUnlockDays,
  }));

  if (isLoading || user === undefined || packages === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Building2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm">Heritage Cooperative</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Choose Your Savings Package</h1>
            <p className="text-muted-foreground">
              Select the plan that matches your daily capacity. Your registration fee depends on your chosen package.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 mb-8">
            {PACKAGES.map((pkg, i) => {
              const isSelected = selected === pkg.id;
              return (
                <motion.button
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  type="button"
                  onClick={() => setSelected(pkg.id)}
                  className={`relative rounded-2xl border p-6 flex flex-col gap-4 text-left transition-all focus:outline-none ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-lg scale-[1.02]"
                      : pkg.popular
                      ? "border-emerald-300 dark:border-emerald-700 bg-card hover:border-emerald-400 shadow-sm"
                      : "border-border bg-card hover:border-emerald-300 shadow-sm"
                  }`}
                >
                  {pkg.popular && !isSelected && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                  )}
                  {isSelected && (
                    <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-white" />
                  )}
                  <div>
                    <h3 className={`text-base font-bold mb-1 ${isSelected ? "text-white" : ""}`}>{pkg.name}</h3>
                    <p className={`text-xs leading-relaxed ${isSelected ? "text-emerald-100" : "text-muted-foreground"}`}>{pkg.desc}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className={`text-xs ${isSelected ? "text-emerald-200" : "text-muted-foreground"}`}>Daily contribution</p>
                      <p className={`text-2xl font-extrabold ${isSelected ? "text-white" : "text-foreground"}`}>
                        {pkg.flexibleDaily ? "Flexible" : `₦${pkg.daily.toLocaleString("en-NG")}`}
                      </p>
                    </div>
                    <div>
                      {pkg.flexibleDaily ? (
                        <>
                          <p className={`text-xs ${isSelected ? "text-emerald-200" : "text-muted-foreground"}`}>
                            Interest after {pkg.interestUnlockDays ?? 90} days
                          </p>
                          <p className={`font-bold text-lg ${isSelected ? "text-white" : "text-emerald-600"}`}>
                            {pkg.interestRatePercent ?? 0}%
                          </p>
                        </>
                      ) : (
                        <>
                          <p className={`text-xs ${isSelected ? "text-emerald-200" : "text-muted-foreground"}`}>Loan after {pkg.durationDays} days</p>
                          <p className={`font-bold text-lg ${isSelected ? "text-white" : "text-emerald-600"}`}>{fmt(pkg.loan)}</p>
                        </>
                      )}
                    </div>
                    <div className={`border-t pt-2 ${isSelected ? "border-emerald-500" : "border-border"}`}>
                      <p className={`text-xs ${isSelected ? "text-emerald-200" : "text-muted-foreground"}`}>Registration fee</p>
                      <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-foreground"}`}>
                        {fmt(pkg.regFee)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`w-fit text-xs ${
                      isSelected
                        ? "bg-white/20 text-white border-transparent"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-transparent"
                    }`}
                  >
                    {pkg.durationDays} days
                  </Badge>
                </motion.button>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleConfirm}
              disabled={!selected || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-10 text-base"
            >
              {saving ? "Saving…" : `Confirm ${PACKAGES.find(p => p.id === selected)?.name ?? "Package"} — Pay ${fmt(PACKAGES.find(p => p.id === selected)?.regFee ?? 0)} to register`}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
