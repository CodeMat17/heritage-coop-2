"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Building2, Moon, Sun, Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

function AuthedNavActions({ onNavigate, pathname }: { onNavigate?: () => void; pathname?: string }) {
  const user = useQuery(api.users.current);
  return user?.isOnboarded ? (
    pathname === "/dashboard" ? null : (
    <Link href="/dashboard" onClick={onNavigate}>
      <Button  className="bg-emerald-600 hover:bg-emerald-700 text-white hidden sm:flex py-4">
        Dashboard
      </Button>
    </Link>
    )
  ) : (
    <Link href="/onboarding" onClick={onNavigate}>
      <Button  className="bg-emerald-600 hover:bg-emerald-700 text-white hidden sm:flex py-4">
        Complete Setup
      </Button>
    </Link>
  );
}

function AuthedMobileActions({ onNavigate }: { onNavigate: () => void }) {
  const user = useQuery(api.users.current);
  return user?.isOnboarded ? (
    <Link href="/dashboard" onClick={onNavigate}>
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Dashboard</Button>
    </Link>
  ) : (
    <Link href="/onboarding" onClick={onNavigate}>
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Complete Setup</Button>
    </Link>
  );
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  if (!resolvedTheme) return null;
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Navbar() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  const isDashboardRoute = pathname.startsWith("/dashboard");

  const navLinks = [
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#packages", label: "Packages" },
    { href: "/#faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm sm:text-base leading-tight">
              Heritage<span className="text-emerald-600"> Coop</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          {!isDashboardRoute && (
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle — desktop */}
            <span className="">
              <ThemeToggle />
            </span>

            <Unauthenticated>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="hidden sm:flex">Sign in</Button>
              </SignInButton>
              <Link href="/sign-up">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white hidden md:flex py-4">
                  Get Started
                </Button>
              </Link>
            </Unauthenticated>

            <Authenticated>
              <AuthedNavActions pathname={pathname} />
              <UserButton />
            </Authenticated>

            {/* Mobile menu — Sheet */}
            {!isDashboardRoute && (
              <Sheet key={pathname} open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <button
                    className="md:hidden h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground"
                    aria-label="Open menu"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full! sm:max-w-sm! px-4 pt-6 pb-8">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  {/* Logo inside sheet */}
                  <div className="flex items-center gap-8 mb-6">
                    <Link href="/" className="flex items-center gap-2.5" onClick={() => setSheetOpen(false)}>
                      <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-bold text-base leading-tight">
                        Heritage<span className="text-emerald-600"> Coop</span>
                      </span>
                    </Link>
                   
                  </div>

                  {/* Nav links */}
                  <nav className="flex flex-col gap-1 mb-6">
                    {navLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setSheetOpen(false)}
                        className="text-base py-3 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </nav>

                  {/* Auth actions */}
                  <div className="flex flex-col gap-2">
                    <Unauthenticated>
                      <SignInButton mode="modal">
                        <button className="w-full text-left text-base py-4 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          Sign in
                        </button>
                      </SignInButton>
                      <Link href="/sign-up" onClick={() => setSheetOpen(false)}>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4">
                          Get Started
                        </Button>
                      </Link>
                    </Unauthenticated>
                    <Authenticated>
                      <AuthedMobileActions onNavigate={() => setSheetOpen(false)} />
                    </Authenticated>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
