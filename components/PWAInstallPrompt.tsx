"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALLED_KEY = "pwa-installed";
const REMIND_LATER_KEY = "pwa-remind-after";
const REMIND_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours

function isAlreadyInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true) ||
    localStorage.getItem(INSTALLED_KEY) === "1"
  );
}

function isSnoozed() {
  const remindAfter = localStorage.getItem(REMIND_LATER_KEY);
  return remindAfter !== null && Date.now() < Number(remindAfter);
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAlreadyInstalled() || isSnoozed()) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (ios) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function snooze() {
    localStorage.setItem(REMIND_LATER_KEY, String(Date.now() + REMIND_DELAY_MS));
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
      setDeferredPrompt(null);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Install app"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-4 shadow-xl shadow-emerald-900/10 backdrop-blur-md dark:border-emerald-900/40 dark:bg-zinc-900/90">
        {/* Top row: icon + text */}
        <div className="flex items-center gap-3">
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
                />{" "}
                then{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Add to Home Screen
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Install for a faster experience
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
              <Download size={14} strokeWidth={2.5} />
              Install
            </button>
          )}
          <button
            onClick={snooze}
            className="flex flex-1 items-center justify-center rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
