"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_INSTALLED = "pwa-installed";
const KEY_DISMISSED = "pwa-dismissed";       // user chose "never show again"
const KEY_SNOOZE    = "pwa-remind-after";
const SNOOZE_MS     = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Detection helpers ───────────────────────────────────────────────────────

/**
 * True when the app is already running in standalone (installed) mode.
 * Works across browsers / iOS Safari.
 */
function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets this when launched from Home Screen
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/**
 * Uses the Chromium-only getInstalledRelatedApps() to definitively detect
 * whether the PWA is already installed on the device, even when the page is
 * opened in the browser (not from the installed app).
 * Falls back to false on unsupported browsers.
 */
async function isInstalledViaRelatedApps(): Promise<boolean> {
  if (!("getInstalledRelatedApps" in navigator)) return false;
  try {
    const apps = await (
      navigator as Navigator & {
        getInstalledRelatedApps: () => Promise<unknown[]>;
      }
    ).getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

function readInstalledFlag(): boolean {
  try {
    return localStorage.getItem(KEY_INSTALLED) === "1";
  } catch {
    return false;
  }
}

function setInstalledFlag(): void {
  try {
    localStorage.setItem(KEY_INSTALLED, "1");
  } catch { /* storage may be unavailable */ }
}

function isDismissedPermanently(): boolean {
  try {
    return localStorage.getItem(KEY_DISMISSED) === "1";
  } catch {
    return false;
  }
}

function setDismissedPermanently(): void {
  try {
    localStorage.setItem(KEY_DISMISSED, "1");
  } catch { /* storage may be unavailable */ }
}

function isSnoozed(): boolean {
  try {
    const until = localStorage.getItem(KEY_SNOOZE);
    return until !== null && Date.now() < Number(until);
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    localStorage.setItem(KEY_SNOOZE, String(Date.now() + SNOOZE_MS));
  } catch { /* storage may be unavailable */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  // Guard: run detection logic only once even under React Strict Mode double-invoke
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // ── Fast synchronous bail-outs ──────────────────────────────────────────

    // Already running as installed app — never prompt
    if (isRunningStandalone()) return;

    // User explicitly said "never show again"
    if (isDismissedPermanently()) return;

    // User snoozed
    if (isSnoozed()) return;

    // Previously recorded as installed (localStorage fallback)
    if (readInstalledFlag()) return;

    // ── Detect iOS Safari ──────────────────────────────────────────────────

    const ios =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      !("MSStream" in window); // exclude IE11 on Windows Phone
    setIsIOS(ios);

    // ── Async: use authoritative API before showing anything ────────────────

    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    isInstalledViaRelatedApps().then((alreadyInstalled) => {
      if (cancelled) return;

      if (alreadyInstalled) {
        // Record so future checks are instant
        setInstalledFlag();
        return;
      }

      if (ios) {
        // iOS: no browser prompt API, show manual instructions
        setVisible(true);
        return;
      }

      // ── Non-iOS: listen for the browser install gate event ──────────────
      // The browser only fires `beforeinstallprompt` when the PWA is NOT
      // installed — so if it fires, we know we can offer installation.

      const onBeforeInstall = (e: Event) => {
        e.preventDefault(); // prevent mini-infobar on mobile Chrome
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      };

      const onAppInstalled = () => {
        setInstalledFlag();
        setDeferredPrompt(null);
        setVisible(false);
      };

      window.addEventListener("beforeinstallprompt", onBeforeInstall);
      window.addEventListener("appinstalled", onAppInstalled);

      removeListeners = () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onAppInstalled);
      };
    });

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalledFlag();
      setDeferredPrompt(null);
      setVisible(false);
    }
  }

  function handleSnooze() {
    snooze();
    setVisible(false);
  }

  function handleDismiss() {
    setDismissedPermanently();
    setVisible(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Install Heritage Cooperative app"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="relative flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/95 px-4 py-4 shadow-xl shadow-emerald-900/10 backdrop-blur-md dark:border-emerald-900/40 dark:bg-zinc-900/95">
        {/* Permanent-dismiss (×) */}
        <button
          onClick={handleDismiss}
          aria-label="Don't show install prompt again"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        {/* Icon + text */}
        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/30">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
              <path d="M9 22V12h6v10" />
              <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Heritage Cooperative
            </p>

            {isIOS ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Tap{" "}
                <Share
                  className="inline-block align-text-bottom text-emerald-600"
                  size={12}
                  strokeWidth={2}
                  aria-label="Share"
                />{" "}
                then{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Add to Home Screen
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Install for a faster, offline-ready experience
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/40 transition-colors hover:bg-emerald-700 active:scale-95"
            >
              <Download size={14} strokeWidth={2.5} aria-hidden="true" />
              Install
            </button>
          )}
          <button
            onClick={handleSnooze}
            className="flex flex-1 items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
