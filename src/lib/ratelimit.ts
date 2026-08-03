import type { Store } from "./store";
import { DEMO_PREFIX } from "./seed";

/**
 * Per-IP sliding-window rate limit (spec 01 §6): 30 messages/hour/IP,
 * approximated with the standard two-bucket sliding window over hourly
 * fixed windows (previous bucket weighted by the un-elapsed fraction).
 */

export const RATE_LIMIT_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

export async function checkRateLimit(
  store: Store,
  ip: string,
  nowMs = Date.now(),
): Promise<{ allowed: boolean; count: number }> {
  const bucket = Math.floor(nowMs / HOUR_MS);
  const elapsedFraction = (nowMs % HOUR_MS) / HOUR_MS;
  const currentKey = `${DEMO_PREFIX}rate:${ip}:${bucket}`;
  const prevKey = `${DEMO_PREFIX}rate:${ip}:${bucket - 1}`;

  const [current, prev] = await Promise.all([
    store.get<number>(currentKey),
    store.get<number>(prevKey),
  ]);
  const weighted = (current ?? 0) + (prev ?? 0) * (1 - elapsedFraction);
  if (weighted >= RATE_LIMIT_PER_HOUR) {
    return { allowed: false, count: Math.round(weighted) };
  }
  const next = await store.incrBy(currentKey, 1, { ttlSeconds: 2 * 60 * 60 });
  return { allowed: true, count: next };
}

/** Client IP from Vercel/proxy headers; "local" for dev. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}
