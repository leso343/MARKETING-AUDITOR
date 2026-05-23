/**
 * ⚠️  M-2 NOTE: This limiter stores per-process state in a Map. On
 *    serverless platforms (Vercel/AWS Lambda) each cold-started
 *    invocation has its OWN map, so the configured "N per window per
 *    IP" cap is really "N per IP per warm instance per window".
 *    Attackers rotating across cold starts can bypass it.
 *
 *    For real cross-instance rate limiting, swap this module for an
 *    Upstash Redis or Vercel KV backend (`@upstash/ratelimit` is one
 *    drop-in). Suggested migration:
 *
 *      1. provision an Upstash KV store, add @upstash/ratelimit
 *      2. re-export rateLimit() with the same signature backed by
 *         `new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(...) })`
 *      3. delete the Map below
 *
 *    Until then, treat the existing limits as best-effort and rely on
 *    Stripe webhook signatures, NextAuth's per-request guards, and the
 *    plan-cap enforcement in lib/billing-access to provide the real
 *    abuse protection.
 */
/**
 * In-memory sliding-window rate limiter.
 *
 * For serverless (Vercel), in-memory state resets on cold starts — this is
 * intentional: it's a best-effort guard against abuse, not a hard quota.
 * For stricter limits, swap for Redis (Upstash) later.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60s to prevent memory leaks
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  /** When the oldest request in the window expires (ms since epoch) */
  reset: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  cleanup(config.windowMs);

  const now = Date.now();
  const cutoff = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.max) {
    const oldestInWindow = entry.timestamps[0];
    return {
      success: false,
      remaining: 0,
      limit: config.max,
      reset: oldestInWindow + config.windowMs,
    };
  }

  entry.timestamps.push(now);
  return {
    success: true,
    remaining: config.max - entry.timestamps.length,
    limit: config.max,
    reset: now + config.windowMs,
  };
}

/** Get IP from request headers (works behind Vercel/Cloudflare proxy) */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Standard rate-limit headers for the response */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  };
}
