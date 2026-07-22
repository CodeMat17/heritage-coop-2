"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Building2,
  CheckCircle2,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  BarChart3,
  ChevronRight,
  Star,
} from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const DEFAULT_HERO = {
  badge: "Registered Cooperative Society · Nigeria",
  headline: "Save Daily. Build Wealth. Access Loans.",
  subtext:
    "Heritage Multipurpose Cooperative helps you develop a consistent savings habit and rewards you with loan access after 90 days of contribution.",
  bullets: ["No hidden charges", "Secure payments", "90-day loan access"],
};

const DEFAULT_HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create Account",
    desc: "Sign up and complete your KYC onboarding in minutes. Your data is secured and encrypted.",
  },
  {
    step: "02",
    title: "Choose a Package",
    desc: "Select from 5 packages (Bronze to Emerald) based on your daily savings capacity.",
  },
  {
    step: "03",
    title: "Save & Unlock Loan",
    desc: "Contribute your daily amount for 90 days to unlock your loan entitlement.",
  },
];
const HOW_IT_WORKS_ICONS = [Users, Wallet, TrendingUp];

const DEFAULT_WHY_US = [
  { title: "Legally Registered", desc: "Registered under Nigerian cooperative law. Your contributions are protected." },
  { title: "Flexible Loan Access", desc: "Unlock loans up to ₦2,000,000 based on your package after 90 days." },
  { title: "Track Your Progress", desc: "Real-time dashboard showing contribution days, total saved, and loan eligibility." },
  { title: "No Collateral", desc: "Access cooperative loans without physical collateral — your contribution record is enough." },
  { title: "Community Driven", desc: "A cooperative model where members support each other's financial growth." },
  { title: "Secure Payments", desc: "All transactions processed via Squadco — PCI-DSS compliant payment infrastructure." },
];
const WHY_US_ICONS = [Shield, Wallet, BarChart3, CheckCircle2, Users, Shield];

const DEFAULT_FAQS = [
  {
    q: "How does Heritage Cooperative work?",
    a: "You select a savings package, contribute your daily amount for 90 consecutive days, and then become eligible to access a loan equal to your package's entitlement.",
  },
  {
    q: "Can I change my package after selecting one?",
    a: "Yes — you can switch packages at any time before applying for a loan. Your existing contribution days are preserved; only the daily amount and loan entitlement change. Package changes are locked once a loan application is pending or approved.",
  },
  {
    q: "How is the loan amount determined?",
    a: "Each package has a fixed loan entitlement. After completing 90 days of contributions, you can apply for up to your package's maximum loan amount.",
  },
  {
    q: "What payment methods are supported?",
    a: "We accept all major Nigerian cards, bank transfers, and USSD payments through our secure Squadco payment gateway.",
  },
  {
    q: "How long does loan approval take?",
    a: "Loan applications are reviewed within 3–5 business days after submission. You will be notified via your registered email.",
  },
  {
    q: "Is my money safe?",
    a: "Heritage Multipurpose Cooperative Society is a registered cooperative operating under Nigerian cooperative law. All payments are processed via PCI-DSS compliant Squadco infrastructure.",
  },
];

function fmt(n: number) {
  return n >= 1_000_000
    ? `₦${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : `₦${n.toLocaleString("en-NG")}`;
}

export default function HomePage() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const showDashboard = isAuthenticated && currentUser?.isOnboarded === true;

  const content = useQuery(api.content.getAll);
  const hero = (content?.hero as typeof DEFAULT_HERO | undefined) ?? DEFAULT_HERO;
  const howItWorks =
    (content?.["how-it-works"] as { step: string; title: string; desc: string }[] | undefined) ??
    DEFAULT_HOW_IT_WORKS;
  const whyUs = (content?.["why-us"] as { title: string; desc: string }[] | undefined) ?? DEFAULT_WHY_US;
  const faqs = (content?.faq as { q: string; a: string }[] | undefined) ?? DEFAULT_FAQS;
  const packagesData = useQuery(api.packages.list);
  const PACKAGES = (packagesData ?? []).map((p) => ({
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

  const homeStats = useQuery(api.stats.getHomepageStats);
  const STATS = [
    { value: homeStats ? `${homeStats.activeMembers}+` : "—", label: "Active Members" },
    { value: homeStats ? fmt(homeStats.totalSaved) : "—", label: "Total Saved" },
    { value: homeStats ? fmt(homeStats.totalDisbursed) : "—", label: "Loans Disbursed" },
    { value: homeStats ? `${homeStats.yearsActive}+` : "—", label: "Years Active" },
  ];

  return (
    <div className='overflow-x-hidden'>
      {/* ── HERO ── */}
      <section className='relative min-h-[calc(100vh-4rem)] flex items-center'>
        {/* Background gradient */}
        <div className='absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50 via-background to-background dark:from-emerald-950/20 dark:via-background dark:to-background' />
        <div className='absolute top-20 right-0 -z-10 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl' />
        <div className='absolute bottom-10 left-10 -z-10 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl' />

        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full'>
          <motion.div
            variants={stagger}
            initial='hidden'
            animate='show'
            className='max-w-3xl'>
            <motion.div variants={fadeUp}>
              <Badge
                variant='outline'
                className='mb-6 gap-1.5 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 px-3 py-1'>
                <Star className='h-3 w-3 fill-emerald-500 text-emerald-500' />
                {hero.badge}
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className='text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6'>
              {hero.headline}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className='text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl'>
              {hero.subtext}
            </motion.p>

            <motion.div
              variants={fadeUp}
              className='flex flex-col items-center sm:flex-row sm:items-start gap-3 mb-12'>
              <Link href={showDashboard ? "/dashboard" : "/sign-up"}>
                <Button
                  size='lg'
                  className='bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 px-6 text-base'>
                  {showDashboard ? "Dashboard" : "Start Saving Today"}
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </Link>
              <Link href='#packages'>
                <Button
                  size='lg'
                  variant='outline'
                  className='h-12 px-6 text-base'>
                  View Packages
                </Button>
              </Link>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className='flex flex-wrap gap-x-6 gap-y-2'>
              {hero.bullets.map((t) => (
                <span
                  key={t}
                  className='flex items-center gap-1.5 text-sm text-muted-foreground'>
                  <CheckCircle2 className='h-4 w-4 text-emerald-500 shrink-0' />
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={stagger}
            initial='hidden'
            animate='show'
            className='grid grid-cols-2 md:grid-cols-4 gap-4 mt-20'>
            {/* {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
                <p className='text-2xl sm:text-3xl font-extrabold text-emerald-600'>
                  {s.value}
                </p>
                <p className='text-sm text-muted-foreground mt-1'>{s.label}</p>
              </motion.div>
            ))} */}

            <motion.div
              variants={fadeUp}
              className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
              <p className='text-2xl sm:text-3xl font-extrabold text-emerald-600'>
                99+
              </p>
              <p className='text-sm text-muted-foreground mt-1'>
                Active Members
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
              <p className='text-2xl sm:text-3xl font-extrabold text-emerald-600'>
                11M+
              </p>
              <p className='text-sm text-muted-foreground mt-1'>Total Saved</p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
              <p className='text-2xl sm:text-3xl font-extrabold text-emerald-600'>
                5M+
              </p>
              <p className='text-sm text-muted-foreground mt-1'>
                Loans Disbursed{" "}
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className='rounded-2xl border border-border bg-card p-5 shadow-sm'>
              <p className='text-2xl sm:text-3xl font-extrabold text-emerald-600'>
                2+
              </p>
              <p className='text-sm text-muted-foreground mt-1'>Years Active</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id='how-it-works' className='py-24 bg-muted/40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <motion.div
            variants={stagger}
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: "-80px" }}>
            <motion.div variants={fadeUp} className='text-center mb-16'>
              <Badge
                variant='outline'
                className='mb-4 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'>
                How it works
              </Badge>
              <h2 className='text-3xl sm:text-4xl font-bold'>
                Three simple steps from sign-up to loan access.
              </h2>
            </motion.div>

            <div className='grid sm:grid-cols-3 gap-8'>
              {howItWorks.map((s, i) => {
                const Icon = HOW_IT_WORKS_ICONS[i] ?? Users;
                return (
                  <motion.div
                    key={s.step}
                    variants={fadeUp}
                    className='relative rounded-2xl bg-card border border-border p-7 shadow-sm'>
                    <span className='text-5xl font-black text-emerald-100 dark:text-emerald-900/60 absolute top-4 right-5 select-none'>
                      {s.step}
                    </span>
                    <div className='h-11 w-11 rounded-xl bg-emerald-600/10 flex items-center justify-center mb-5'>
                      <Icon className='h-5 w-5 text-emerald-600' />
                    </div>
                    <h3 className='text-lg font-semibold mb-2'>{s.title}</h3>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {s.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PACKAGES ── */}
      <section id='packages' className='py-24'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <motion.div
            variants={stagger}
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: "-80px" }}>
            <motion.div variants={fadeUp} className='text-center mb-16'>
              <Badge
                variant='outline'
                className='mb-4 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'>
                Savings Packages
              </Badge>
              <h2 className='text-3xl sm:text-4xl font-bold mb-3'>
                Choose the package that fits your daily savings capacity.
              </h2>
              <p className='text-muted-foreground'>
                All packages unlock a loan after 90 days.
              </p>
            </motion.div>

            <div className='grid sm:grid-cols-2 md:grid-cols-3 gap-5'>
              {PACKAGES.map((pkg) => (
                <motion.div
                  key={pkg.id}
                  variants={fadeUp}
                  className={`relative rounded-2xl border p-6 flex flex-col gap-4 shadow-sm transition-shadow hover:shadow-md ${
                    pkg.popular
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : "border-border bg-card"
                  }`}>
                  {pkg.popular && (
                    <span className='absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap'>
                      Most Popular
                    </span>
                  )}
                  <div>
                    <h3
                      className={`text-lg font-bold mb-1 ${pkg.popular ? "text-white" : ""}`}>
                      {pkg.name}
                    </h3>
                    <p
                      className={`text-xs leading-relaxed ${pkg.popular ? "text-emerald-100" : "text-muted-foreground"}`}>
                      {pkg.desc}
                    </p>
                  </div>
                  <div className='space-y-1.5'>
                    <div>
                      <p
                        className={`text-xs ${pkg.popular ? "text-emerald-200" : "text-muted-foreground"}`}>
                        Daily
                      </p>
                      <p
                        className={`text-2xl font-extrabold ${pkg.popular ? "text-white" : "text-foreground"}`}>
                        {pkg.flexibleDaily ? "Flexible" : `₦${pkg.daily.toLocaleString("en-NG")}`}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-xs ${pkg.popular ? "text-emerald-200" : "text-muted-foreground"}`}>
                        Duration
                      </p>
                      <p
                        className={`font-semibold ${pkg.popular ? "text-white" : ""}`}>
                        {pkg.flexibleDaily
                          ? `${pkg.interestRatePercent ?? 0}% interest, ${pkg.interestUnlockDays ?? 90}-day unlock`
                          : `${pkg.durationDays} days`}
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-xs ${pkg.popular ? "text-emerald-200" : "text-muted-foreground"}`}>
                        Loan
                      </p>
                      <p
                        className={`font-bold text-lg ${pkg.popular ? "text-white" : "text-emerald-600"}`}>
                        {pkg.flexibleDaily ? "Not applicable" : fmt(pkg.loan)}
                      </p>
                    </div>
                    <div
                      className={`border-t pt-1.5 ${pkg.popular ? "border-emerald-500" : "border-border"}`}>
                      <p
                        className={`text-xs ${pkg.popular ? "text-emerald-200" : "text-muted-foreground"}`}>
                        Registration fee
                      </p>
                      <p
                        className={`text-sm font-bold ${pkg.popular ? "text-white" : "text-foreground"}`}>
                        {fmt(pkg.regFee)}
                      </p>
                    </div>
                  </div>
                  <Link href='/sign-up' className='mt-auto'>
                    <Button
                      className={`w-full ${
                        pkg.popular
                          ? "bg-white text-emerald-700 hover:bg-emerald-50"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                      size='sm'>
                      Get started
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className='py-24 bg-muted/40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <motion.div
            variants={stagger}
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: "-80px" }}>
            <motion.div variants={fadeUp} className='text-center mb-16'>
              <Badge
                variant='outline'
                className='mb-4 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'>
                Why Heritage Cooperative?
              </Badge>
              <h2 className='text-3xl sm:text-4xl font-bold'>
                Built for your financial growth.
              </h2>
            </motion.div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {whyUs.map((item, i) => {
                const Icon = WHY_US_ICONS[i] ?? Shield;
                return (
                  <motion.div
                    key={item.title}
                    variants={fadeUp}
                    className='rounded-2xl bg-card border border-border p-6 shadow-sm'>
                    <div className='h-10 w-10 rounded-xl bg-emerald-600/10 flex items-center justify-center mb-4'>
                      <Icon className='h-5 w-5 text-emerald-600' />
                    </div>
                    <h3 className='font-semibold mb-2'>{item.title}</h3>
                    <p className='text-sm text-muted-foreground leading-relaxed'>
                      {item.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id='faq' className='py-24'>
        <div className='max-w-3xl mx-auto px-4 sm:px-6'>
          <motion.div
            variants={stagger}
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: "-80px" }}>
            <motion.div variants={fadeUp} className='text-center mb-12'>
              <Badge
                variant='outline'
                className='mb-4 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'>
                FAQ
              </Badge>
              <h2 className='text-3xl sm:text-4xl font-bold'>
                Frequently Asked Questions
              </h2>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Accordion type='single' collapsible className='space-y-3'>
                {faqs.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className='border border-border rounded-xl px-5 data-[state=open]:shadow-sm bg-card'>
                    <AccordionTrigger className='text-left font-medium py-4 hover:no-underline'>
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className='text-muted-foreground text-sm leading-relaxed pb-4'>
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className='py-24 bg-emerald-600 dark:bg-emerald-800'>
        <motion.div
          variants={stagger}
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, margin: "-80px" }}
          className='max-w-3xl mx-auto px-4 sm:px-6 text-center'>
          <motion.div variants={fadeUp} className='mb-3 flex justify-center'>
            <div className='h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center'>
              <Building2 className='h-7 w-7 text-white' />
            </div>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className='text-3xl sm:text-4xl font-extrabold text-white mb-4'>
            Ready to start your savings journey?
          </motion.h2>
          <motion.p variants={fadeUp} className='text-emerald-100 mb-8 text-lg'>
            Join 500+ members already building wealth with Heritage Cooperative.
            Start today — your first contribution is just days away.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className='flex flex-wrap justify-center gap-3'>
            <Link href='/sign-up'>
              <Button
                size='lg'
                className='bg-white text-emerald-700 hover:bg-emerald-50 h-12 px-8 text-base font-semibold'>
                Create Account
              </Button>
            </Link>
            <Link href='#packages'>
              <Button
                size='lg'
                variant='outline'
                className='bg-transparent  border-white/40 text-white hover:bg-white/10 h-12 px-8 text-base'>
                View Packages
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className='border-t border-border bg-card py-10'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <div className='h-6 w-6 rounded-md bg-emerald-600 flex items-center justify-center'>
              <Building2 className='h-3 w-3 text-white' />
            </div>
            <span className='font-medium text-foreground'>
              Heritage Multipurpose Cooperative Society
            </span>
          </div>
          <p>
            © {new Date().getFullYear()} All rights reserved · RC Registered
            Nigeria
          </p>
        </div>
      </footer>
    </div>
  );
}
