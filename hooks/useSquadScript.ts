const SQUAD_SCRIPT_URL =
  process.env.NEXT_PUBLIC_SQUAD_ENV === "production"
    ? "https://checkout.squadco.com/widget/squad.min.js"
    : "https://sandbox-lib.squadco.com/squad.js";

// Module-level singleton — only one load attempt across all component instances.
let loadPromise: Promise<void> | null = null;

function pollForSquad(resolve: () => void, reject: (e: Error) => void) {
  const poll = setInterval(() => {
    if (typeof window.squad !== "undefined") {
      clearInterval(poll);
      clearTimeout(timer);
      resolve();
    }
  }, 100);
  const timer = setTimeout(() => {
    clearInterval(poll);
    loadPromise = null; // allow retry after timeout
    reject(new Error("Squad script timed out — window.squad never defined"));
  }, 10_000);
}

function startLoad(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (typeof window.squad !== "undefined") return Promise.resolve();

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SQUAD_SCRIPT_URL}"]`,
    );

    if (existing) {
      // Script already in DOM — poll for window.squad since the load event may have already fired.
      pollForSquad(resolve, reject);
      return;
    }

    const script = document.createElement("script");
    script.src = SQUAD_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      // Script HTTP-loaded — verify window.squad is actually defined before resolving.
      if (typeof window.squad !== "undefined") {
        resolve();
      } else {
        pollForSquad(resolve, reject);
      }
    };
    script.onerror = () => {
      loadPromise = null; // allow retry on next click
      reject(new Error("Squad script failed to load"));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

/** Begin loading the Squad script immediately (call on mount). */
export function preloadSquadScript() {
  startLoad().catch(() => {
    /* silently swallow preload errors; handlePayment will surface them */
  });
}

/** Resolves when window.squad is ready. Rejects on network error or timeout. */
export function loadSquadScript(): Promise<void> {
  return startLoad();
}
