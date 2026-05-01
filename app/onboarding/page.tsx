"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { NIGERIA_STATES, NIGERIA_STATE_TO_LGAS } from "@/lib/nigeria";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

const phoneRegex = /^\+?[0-9]{10,15}$/;

const step1Schema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: z.string().min(1, "Gender is required"),
  nickName: z.string().min(1, "Nickname is required"),
  motherMaidenName: z.string().min(1, "Mother's maiden name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  placeOfBirth: z.string().min(1, "Place of birth is required"),
  nationality: z.string().min(1),
  stateOfOrigin: z.string().min(1, "State of origin is required"),
  lga: z.string().min(1, "LGA is required"),
  homeTown: z.string().min(1, "Home town is required"),
  maritalStatus: z.string().min(1, "Marital status is required"),
  mobilePhoneNumber: z.string().regex(phoneRegex, "Enter a valid phone number"),
  otherPhoneNumber: z.string().optional().superRefine((val, ctx) => {
    if (val && val.length > 0 && !phoneRegex.test(val)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
    }
  }),
  residentialAddress: z.string().min(1, "Residential address is required"),
  permanentAddress: z.string().min(1, "Permanent address is required"),
  taxIdentificationNumber: z.string().optional(),
  typeOfTrade: z.string().min(1, "Type of trade is required"),
  yearsInTrade: z.number().nonnegative(),
  otherTradeOrSkill: z.string().optional(),
  meansOfIdentification: z.string().min(1, "Means of ID is required"),
  meansOfIdentificationStartDate: z.string().min(1, "ID start date is required"),
  meansOfIdentificationExpiryDate: z.string().min(1, "ID expiry date is required"),
  educationalBackground: z.string().min(1, "Educational background is required"),
});

const step2Schema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  bankName: z.string().min(1, "Bank name is required"),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be exactly 11 digits"),
});

const step3Schema = z.object({
  nokSurname: z.string().min(1, "Surname is required"),
  nokFirstName: z.string().min(1, "First name is required"),
  nokOtherName: z.string().min(1, "Other name is required"),
  nokTitle: z.string().min(1, "Title is required"),
  nokDateOfBirth: z.string().min(1, "Date of birth is required"),
  nokGender: z.string().min(1, "Gender is required"),
  nokRelationship: z.string().min(1, "Relationship is required"),
  nokPhoneNumber: z.string().regex(phoneRegex, "Enter a valid phone number"),
  nokEmail: z.string().email("Valid email required"),
  nokHouseAddress: z.string().min(1, "Address is required"),
});

const STEPS = [
  { title: "Personal Information", desc: "Tell us about yourself" },
  { title: "Banking Details", desc: "Your account information" },
  { title: "Next of Kin", desc: "Emergency contact details" },
  { title: "Review & Confirm", desc: "Check your details before submitting" },
];

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-destructive text-xs mt-1">{error}</p>;
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>{children}</div>;
}

function ReviewSection({ title, items }: { title: string; items: { label: string; value?: string }[] }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5 break-words">{value || <span className="text-muted-foreground italic">—</span>}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const ID_LABELS: Record<string, string> = {
  national_id: "National ID card",
  voters_card: "Voter's card",
  passport: "International passport",
  drivers_license: "Driver's licence",
};
const EDU_LABELS: Record<string, string> = {
  fslc: "FSLC",
  wassce: "WASSCE / SSCE",
  nd_hnd: "ND / HND",
  bsc_plus: "B.Sc. & above",
};

export default function OnboardingPage() {
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const convexUser = useQuery(api.users.current);
  const upsertUser = useMutation(api.users.upsertUserData);

  React.useEffect(() => {
    if (!isAuthenticated) router.replace("/sign-in");
  }, [isAuthenticated, router]);

  React.useEffect(() => {
    if (convexUser?.isOnboarded) router.replace("/dashboard");
  }, [convexUser, router]);

  const defaultFullName = convexUser?.name ?? "";

  const [gender, setGender] = React.useState("");
  const [maritalStatus, setMaritalStatus] = React.useState("");
  const [meansOfIdentification, setMeansOfIdentification] = React.useState("");
  const [educationalBackground, setEducationalBackground] = React.useState("");
  const [stateValue, setStateValue] = React.useState("");
  const [lgaValue, setLgaValue] = React.useState("");
  const [dob, setDob] = React.useState<Date | undefined>();
  const [idStart, setIdStart] = React.useState<Date | undefined>();
  const [idExpiry, setIdExpiry] = React.useState<Date | undefined>();
  const [openDob, setOpenDob] = React.useState(false);
  const [openIdStart, setOpenIdStart] = React.useState(false);
  const [openIdExpiry, setOpenIdExpiry] = React.useState(false);
  const [nokGender, setNokGender] = React.useState("");
  const [nokRelationship, setNokRelationship] = React.useState("");
  const [nokDob, setNokDob] = React.useState<Date | undefined>();
  const [openNokDob, setOpenNokDob] = React.useState(false);

  const formRef = React.useRef<HTMLFormElement>(null);
  const [savedStep1, setSavedStep1] = React.useState<ReturnType<typeof collectStep1> | null>(null);
  const [savedStep2, setSavedStep2] = React.useState<ReturnType<typeof collectStep2> | null>(null);
  const [savedStep3, setSavedStep3] = React.useState<ReturnType<typeof collectStep3> | null>(null);

  const maxDob = React.useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d;
  }, []);

  function clearErr(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function collectStep1(fd: FormData) {
    return {
      fullName: String(fd.get("fullName") || ""),
      gender,
      nickName: String(fd.get("nickName") || ""),
      motherMaidenName: String(fd.get("motherMaidenName") || ""),
      dateOfBirth: dob ? dob.toISOString().split("T")[0] : "",
      placeOfBirth: String(fd.get("placeOfBirth") || ""),
      nationality: "Nigeria",
      stateOfOrigin: stateValue,
      lga: lgaValue,
      homeTown: String(fd.get("homeTown") || ""),
      maritalStatus,
      mobilePhoneNumber: String(fd.get("mobilePhoneNumber") || ""),
      otherPhoneNumber: String(fd.get("otherPhoneNumber") || "") || undefined,
      residentialAddress: String(fd.get("residentialAddress") || ""),
      permanentAddress: String(fd.get("permanentAddress") || ""),
      taxIdentificationNumber: String(fd.get("taxIdentificationNumber") || "") || undefined,
      typeOfTrade: String(fd.get("typeOfTrade") || ""),
      yearsInTrade: Number(fd.get("yearsInTrade") || 0),
      otherTradeOrSkill: String(fd.get("otherTradeOrSkill") || "") || undefined,
      meansOfIdentification,
      meansOfIdentificationStartDate: idStart ? idStart.toISOString().split("T")[0] : "",
      meansOfIdentificationExpiryDate: idExpiry ? idExpiry.toISOString().split("T")[0] : "",
      educationalBackground,
    };
  }

  function collectStep2(fd: FormData) {
    return {
      accountName: String(fd.get("accountName") || ""),
      accountNumber: String(fd.get("accountNumber") || ""),
      bankName: String(fd.get("bankName") || ""),
      bvn: String(fd.get("bvn") || ""),
    };
  }

  function collectStep3(fd: FormData) {
    return {
      nokSurname: String(fd.get("nokSurname") || ""),
      nokFirstName: String(fd.get("nokFirstName") || ""),
      nokOtherName: String(fd.get("nokOtherName") || ""),
      nokTitle: String(fd.get("nokTitle") || ""),
      nokDateOfBirth: nokDob ? nokDob.toISOString().split("T")[0] : "",
      nokGender,
      nokRelationship,
      nokPhoneNumber: String(fd.get("nokPhoneNumber") || ""),
      nokEmail: String(fd.get("nokEmail") || ""),
      nokHouseAddress: String(fd.get("nokHouseAddress") || ""),
    };
  }

  function validateStep(stepNum: number, fd: FormData): boolean {
    let result;
    if (stepNum === 1) {
      if (dob) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 18) {
          setFieldErrors({ dateOfBirth: "You must be at least 18 years old." });
          toast.warning("Persons under 18 cannot subscribe.");
          return false;
        }
      }
      result = step1Schema.safeParse(collectStep1(fd));
    } else if (stepNum === 2) {
      result = step2Schema.safeParse(collectStep2(fd));
    } else {
      result = step3Schema.safeParse(collectStep3(fd));
    }

    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = (issue.path?.[0] as string) || "";
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      toast.error("Please fix the highlighted fields.");
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function handleNext() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    if (!validateStep(step, fd)) return;
    if (step === 1) setSavedStep1(collectStep1(fd));
    if (step === 2) setSavedStep2(collectStep2(fd));
    if (step === 3) setSavedStep3(collectStep3(fd));
    setStep(step + 1);
  }

  async function handleFinalSubmit() {
    const payload = { ...savedStep1!, ...savedStep2!, ...savedStep3! };
    setSubmitting(true);
    try {
      await upsertUser(payload);
      toast.success("Profile complete! Now choose your package.");
      router.push("/dashboard/select-package");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const s1 = savedStep1;
  const s2 = savedStep2;
  const s3 = savedStep3;

  const displayName = convexUser?.name || "there";

  return (
    <div className="min-h-screen bg-background">
   

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {displayName}!</h1>
            <p className="text-muted-foreground mt-1">
              Complete your membership profile to get started — takes less than 5 minutes.
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center gap-0">
              {STEPS.map((s, idx) => {
                const stepNum = idx + 1;
                const done = step > stepNum;
                const active = step === stepNum;
                return (
                  <React.Fragment key={s.title}>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                          done
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : active
                            ? "border-emerald-600 text-emerald-600 bg-background"
                            : "border-muted text-muted-foreground bg-background"
                        }`}
                      >
                        {done ? "✓" : stepNum}
                      </div>
                      <span
                        className={`text-xs mt-1.5 font-medium hidden sm:block ${
                          active ? "text-emerald-600" : done ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.title}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 sm:mx-3 transition-colors ${
                          step > stepNum ? "bg-emerald-600" : "bg-muted"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="sm:hidden mt-3">
              <p className="text-sm font-medium">{STEPS[step - 1].title}</p>
              <p className="text-xs text-muted-foreground">{STEPS[step - 1].desc}</p>
            </div>
          </div>

          <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border bg-card p-5 sm:p-7 shadow-sm"
              >
                <h2 className="text-lg font-semibold mb-1">{STEPS[step - 1].title}</h2>
                <p className="text-sm text-muted-foreground mb-6">{STEPS[step - 1].desc}</p>

                {/* ── STEP 1 ── */}
                {step === 1 && (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <Field>
                      <Label>Full name *</Label>
                      <Input name="fullName" defaultValue={defaultFullName} onChange={() => clearErr("fullName")} />
                      <FieldError error={fieldErrors.fullName} />
                    </Field>
                    <Field>
                      <Label>Gender *</Label>
                      <Select value={gender} onValueChange={(v) => { setGender(v); clearErr("gender"); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.gender} />
                    </Field>
                    <Field>
                      <Label>Marital status *</Label>
                      <Select value={maritalStatus} onValueChange={(v) => { setMaritalStatus(v); clearErr("maritalStatus"); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="married">Married</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.maritalStatus} />
                    </Field>
                    <Field>
                      <Label>Date of birth *</Label>
                      <Popover open={openDob} onOpenChange={setOpenDob}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" type="button" className="w-full justify-between font-normal">
                            {dob ? dob.toLocaleDateString() : "Select date"}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={dob} captionLayout="dropdown"
                            toDate={maxDob}
                            fromYear={1920} toYear={maxDob.getFullYear()}
                            onSelect={(d) => { setDob(d as Date | undefined); setOpenDob(false); clearErr("dateOfBirth"); }} />
                        </PopoverContent>
                      </Popover>
                      <FieldError error={fieldErrors.dateOfBirth} />
                    </Field>
                    <Field>
                      <Label>Place of birth *</Label>
                      <Input name="placeOfBirth" onChange={() => clearErr("placeOfBirth")} />
                      <FieldError error={fieldErrors.placeOfBirth} />
                    </Field>
                    <Field>
                      <Label>Nickname *</Label>
                      <Input name="nickName" onChange={() => clearErr("nickName")} />
                      <FieldError error={fieldErrors.nickName} />
                    </Field>
                    <Field>
                      <Label>Mother&apos;s maiden name *</Label>
                      <Input name="motherMaidenName" onChange={() => clearErr("motherMaidenName")} />
                      <FieldError error={fieldErrors.motherMaidenName} />
                    </Field>
                    <Field>
                      <Label>Nationality</Label>
                      <Input name="nationality" value="Nigeria" readOnly className="bg-muted" />
                    </Field>
                    <Field>
                      <Label>State of origin *</Label>
                      <Select value={stateValue} onValueChange={(v) => { setStateValue(v); setLgaValue(""); clearErr("stateOfOrigin"); }}>
                        <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                        <SelectContent>
                          {NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.stateOfOrigin} />
                    </Field>
                    <Field>
                      <Label>LGA *</Label>
                      <Select value={lgaValue} onValueChange={(v) => { setLgaValue(v); clearErr("lga"); }} disabled={!stateValue}>
                        <SelectTrigger><SelectValue placeholder="Select LGA" /></SelectTrigger>
                        <SelectContent>
                          {(NIGERIA_STATE_TO_LGAS[stateValue] ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.lga} />
                    </Field>
                    <Field>
                      <Label>Home town *</Label>
                      <Input name="homeTown" onChange={() => clearErr("homeTown")} />
                      <FieldError error={fieldErrors.homeTown} />
                    </Field>
                    <Field>
                      <Label>Mobile phone *</Label>
                      <Input name="mobilePhoneNumber" type="tel" onChange={() => clearErr("mobilePhoneNumber")} />
                      <FieldError error={fieldErrors.mobilePhoneNumber} />
                    </Field>
                    <Field>
                      <Label>Other phone</Label>
                      <Input name="otherPhoneNumber" type="tel" onChange={() => clearErr("otherPhoneNumber")} />
                      <FieldError error={fieldErrors.otherPhoneNumber} />
                    </Field>
                    <Field className="sm:col-span-2">
                      <Label>Residential address *</Label>
                      <Textarea name="residentialAddress" rows={2} onChange={() => clearErr("residentialAddress")} />
                      <FieldError error={fieldErrors.residentialAddress} />
                    </Field>
                    <Field className="sm:col-span-2">
                      <Label>Permanent address *</Label>
                      <Textarea name="permanentAddress" rows={2} onChange={() => clearErr("permanentAddress")} />
                      <FieldError error={fieldErrors.permanentAddress} />
                    </Field>
                    <Field>
                      <Label>Tax identification number</Label>
                      <Input name="taxIdentificationNumber" />
                    </Field>
                    <Field>
                      <Label>Type of trade *</Label>
                      <Input name="typeOfTrade" onChange={() => clearErr("typeOfTrade")} />
                      <FieldError error={fieldErrors.typeOfTrade} />
                    </Field>
                    <Field>
                      <Label>Years in trade *</Label>
                      <Input name="yearsInTrade" type="number" min="0" onChange={() => clearErr("yearsInTrade")} />
                      <FieldError error={fieldErrors.yearsInTrade} />
                    </Field>
                    <Field>
                      <Label>Other trade / skill</Label>
                      <Input name="otherTradeOrSkill" />
                    </Field>
                    <Field>
                      <Label>Means of identification *</Label>
                      <Select value={meansOfIdentification} onValueChange={(v) => { setMeansOfIdentification(v); clearErr("meansOfIdentification"); }}>
                        <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national_id">National ID card</SelectItem>
                          <SelectItem value="voters_card">Voter&apos;s card</SelectItem>
                          <SelectItem value="passport">International passport</SelectItem>
                          <SelectItem value="drivers_license">Driver&apos;s licence</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.meansOfIdentification} />
                    </Field>
                    <Field>
                      <Label>ID issue date *</Label>
                      <Popover open={openIdStart} onOpenChange={setOpenIdStart}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" type="button" className="w-full justify-between font-normal">
                            {idStart ? idStart.toLocaleDateString() : "Select date"}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={idStart} captionLayout="dropdown" fromYear={2000} toYear={2060}
                            onSelect={(d) => { setIdStart(d as Date | undefined); setOpenIdStart(false); clearErr("meansOfIdentificationStartDate"); }} />
                        </PopoverContent>
                      </Popover>
                      <FieldError error={fieldErrors.meansOfIdentificationStartDate} />
                    </Field>
                    <Field>
                      <Label>ID expiry date *</Label>
                      <Popover open={openIdExpiry} onOpenChange={setOpenIdExpiry}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" type="button" className="w-full justify-between font-normal">
                            {idExpiry ? idExpiry.toLocaleDateString() : "Select date"}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={idExpiry} captionLayout="dropdown" fromYear={2000} toYear={2060}
                            onSelect={(d) => { setIdExpiry(d as Date | undefined); setOpenIdExpiry(false); clearErr("meansOfIdentificationExpiryDate"); }} />
                        </PopoverContent>
                      </Popover>
                      <FieldError error={fieldErrors.meansOfIdentificationExpiryDate} />
                    </Field>
                    <Field>
                      <Label>Educational background *</Label>
                      <Select value={educationalBackground} onValueChange={(v) => { setEducationalBackground(v); clearErr("educationalBackground"); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fslc">FSLC</SelectItem>
                          <SelectItem value="wassce">WASSCE / SSCE</SelectItem>
                          <SelectItem value="nd_hnd">ND / HND</SelectItem>
                          <SelectItem value="bsc_plus">B.Sc. &amp; above</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.educationalBackground} />
                    </Field>
                  </div>
                )}

                {/* ── STEP 2 ── */}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <Label>Account name *</Label>
                      <Input name="accountName" onChange={() => clearErr("accountName")} />
                      <FieldError error={fieldErrors.accountName} />
                    </Field>
                    <Field>
                      <Label>Account number *</Label>
                      <Input name="accountNumber" maxLength={10} onChange={() => clearErr("accountNumber")} />
                      <FieldError error={fieldErrors.accountNumber} />
                    </Field>
                    <Field>
                      <Label>Bank name *</Label>
                      <Input name="bankName" onChange={() => clearErr("bankName")} />
                      <FieldError error={fieldErrors.bankName} />
                    </Field>
                    <Field>
                      <Label>BVN *</Label>
                      <Input name="bvn" maxLength={11} placeholder="11-digit BVN" onChange={() => clearErr("bvn")} />
                      <FieldError error={fieldErrors.bvn} />
                    </Field>
                    <div className="sm:col-span-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-700 dark:text-amber-400">
                      Your banking details are used solely for loan disbursement and are stored securely.
                    </div>
                  </div>
                )}

                {/* ── STEP 3 ── */}
                {step === 3 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <Label>Surname *</Label>
                      <Input name="nokSurname" onChange={() => clearErr("nokSurname")} />
                      <FieldError error={fieldErrors.nokSurname} />
                    </Field>
                    <Field>
                      <Label>First name *</Label>
                      <Input name="nokFirstName" onChange={() => clearErr("nokFirstName")} />
                      <FieldError error={fieldErrors.nokFirstName} />
                    </Field>
                    <Field>
                      <Label>Other name *</Label>
                      <Input name="nokOtherName" onChange={() => clearErr("nokOtherName")} />
                      <FieldError error={fieldErrors.nokOtherName} />
                    </Field>
                    <Field>
                      <Label>Title *</Label>
                      <Input name="nokTitle" placeholder="Mr / Mrs / Dr …" onChange={() => clearErr("nokTitle")} />
                      <FieldError error={fieldErrors.nokTitle} />
                    </Field>
                    <Field>
                      <Label>Date of birth *</Label>
                      <Popover open={openNokDob} onOpenChange={setOpenNokDob}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" type="button" className="w-full justify-between font-normal">
                            {nokDob ? nokDob.toLocaleDateString() : "Select date"}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={nokDob} captionLayout="dropdown"
                            onSelect={(d) => { setNokDob(d as Date | undefined); setOpenNokDob(false); clearErr("nokDateOfBirth"); }} />
                        </PopoverContent>
                      </Popover>
                      <FieldError error={fieldErrors.nokDateOfBirth} />
                    </Field>
                    <Field>
                      <Label>Gender *</Label>
                      <Select value={nokGender} onValueChange={(v) => { setNokGender(v); clearErr("nokGender"); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.nokGender} />
                    </Field>
                    <Field>
                      <Label>Relationship *</Label>
                      <Select value={nokRelationship} onValueChange={(v) => { setNokRelationship(v); clearErr("nokRelationship"); }}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="friend">Friend</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError error={fieldErrors.nokRelationship} />
                    </Field>
                    <Field>
                      <Label>Phone number *</Label>
                      <Input name="nokPhoneNumber" type="tel" onChange={() => clearErr("nokPhoneNumber")} />
                      <FieldError error={fieldErrors.nokPhoneNumber} />
                    </Field>
                    <Field>
                      <Label>Email *</Label>
                      <Input name="nokEmail" type="email" onChange={() => clearErr("nokEmail")} />
                      <FieldError error={fieldErrors.nokEmail} />
                    </Field>
                    <Field className="sm:col-span-2">
                      <Label>House address *</Label>
                      <Textarea name="nokHouseAddress" rows={2} onChange={() => clearErr("nokHouseAddress")} />
                      <FieldError error={fieldErrors.nokHouseAddress} />
                    </Field>
                  </div>
                )}

                {/* ── STEP 4 — Review & Confirm ── */}
                {step === 4 && (
                  <div>
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-700 dark:text-emerald-400 mb-6">
                      Please review all your information carefully. Go back to edit any section before submitting.
                    </div>

                    <ReviewSection
                      title="Personal Information"
                      items={[
                        { label: "Full name", value: s1?.fullName },
                        { label: "Gender", value: s1?.gender ? s1.gender.charAt(0).toUpperCase() + s1.gender.slice(1) : undefined },
                        { label: "Nickname", value: s1?.nickName },
                        { label: "Mother's maiden name", value: s1?.motherMaidenName },
                        { label: "Date of birth", value: s1?.dateOfBirth },
                        { label: "Place of birth", value: s1?.placeOfBirth },
                        { label: "Nationality", value: s1?.nationality },
                        { label: "State of origin", value: s1?.stateOfOrigin },
                        { label: "LGA", value: s1?.lga },
                        { label: "Home town", value: s1?.homeTown },
                        { label: "Marital status", value: s1?.maritalStatus ? s1.maritalStatus.charAt(0).toUpperCase() + s1.maritalStatus.slice(1) : undefined },
                        { label: "Mobile phone", value: s1?.mobilePhoneNumber },
                        { label: "Other phone", value: s1?.otherPhoneNumber },
                        { label: "Residential address", value: s1?.residentialAddress },
                        { label: "Permanent address", value: s1?.permanentAddress },
                        { label: "Tax ID number", value: s1?.taxIdentificationNumber },
                        { label: "Type of trade", value: s1?.typeOfTrade },
                        { label: "Years in trade", value: s1?.yearsInTrade !== undefined ? String(s1.yearsInTrade) : undefined },
                        { label: "Other trade / skill", value: s1?.otherTradeOrSkill },
                        { label: "Means of identification", value: s1?.meansOfIdentification ? ID_LABELS[s1.meansOfIdentification] : undefined },
                        { label: "ID issue date", value: s1?.meansOfIdentificationStartDate },
                        { label: "ID expiry date", value: s1?.meansOfIdentificationExpiryDate },
                        { label: "Educational background", value: s1?.educationalBackground ? EDU_LABELS[s1.educationalBackground] : undefined },
                      ]}
                    />

                    <div className="border-t my-4" />

                    <ReviewSection
                      title="Banking Details"
                      items={[
                        { label: "Account name", value: s2?.accountName },
                        { label: "Account number", value: s2?.accountNumber },
                        { label: "Bank name", value: s2?.bankName },
                        { label: "BVN", value: s2?.bvn ? `••••••${s2.bvn.slice(-5)}` : undefined },
                      ]}
                    />

                    <div className="border-t my-4" />

                    <ReviewSection
                      title="Next of Kin"
                      items={[
                        { label: "Title", value: s3?.nokTitle },
                        { label: "Surname", value: s3?.nokSurname },
                        { label: "First name", value: s3?.nokFirstName },
                        { label: "Other name", value: s3?.nokOtherName },
                        { label: "Date of birth", value: s3?.nokDateOfBirth },
                        { label: "Gender", value: s3?.nokGender ? s3.nokGender.charAt(0).toUpperCase() + s3.nokGender.slice(1) : undefined },
                        { label: "Relationship", value: s3?.nokRelationship ? s3.nokRelationship.charAt(0).toUpperCase() + s3.nokRelationship.slice(1) : undefined },
                        { label: "Phone number", value: s3?.nokPhoneNumber },
                        { label: "Email", value: s3?.nokEmail },
                        { label: "House address", value: s3?.nokHouseAddress },
                      ]}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-6">
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <span className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</span>
              {step < STEPS.length ? (
                <Button type="button" onClick={handleNext} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleFinalSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {submitting ? "Submitting…" : "Complete Profile"}
                </Button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
