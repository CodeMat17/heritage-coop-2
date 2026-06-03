const store = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5;   // per IP per window

export function rateLimit(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const timestamps = (store.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfter };
  }

  timestamps.push(now);
  store.set(ip, timestamps);
  return { limited: false, retryAfter: 0 };
}
