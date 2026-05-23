/**
 * Sentry error tracking — opt-in via NEXT_PUBLIC_SENTRY_DSN env var.
 *
 * Usage:
 *   import { captureException, captureMessage } from "@/lib/sentry";
 *   captureException(error);
 *   captureMessage("Something noteworthy happened");
 *
 * When NEXT_PUBLIC_SENTRY_DSN is unset, all calls are no-ops.
 *
 * To fully integrate Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Set NEXT_PUBLIC_SENTRY_DSN in your environment
 *   3. Run `npx @sentry/wizard@latest -i nextjs` for instrumentation
 *
 * This module provides a lightweight shim so the codebase can call
 * captureException() everywhere without hard-depending on @sentry/nextjs.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

interface SentryLike {
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
  setUser: (user: { id: string; email?: string } | null) => void;
}

let _sentry: SentryLike | null = null;

async function getSentry(): Promise<SentryLike | null> {
  if (!DSN) return null;
  if (_sentry) return _sentry;

  try {
    // Dynamic import so the app doesn't break if @sentry/nextjs isn't installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await (Function('return import("@sentry/nextjs")')() as Promise<Record<string, unknown>>);
    if (typeof mod.init !== "function") return null;

    (mod.init as (opts: Record<string, unknown>) => void)({
      dsn: DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // 10% of transactions
      // Reduce noise — ignore ResizeObserver and hydration mismatches
      ignoreErrors: [
        "ResizeObserver loop",
        "Hydration failed",
        "Text content does not match",
      ],
    });

    _sentry = mod as unknown as SentryLike;
    return _sentry;
  } catch {
    // @sentry/nextjs not installed — that's fine
    return null;
  }
}

/**
 * Report an exception to Sentry. No-op when Sentry is not configured.
 */
export async function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const s = await getSentry();
  s?.captureException(err, context);
}

/**
 * Send a message to Sentry. No-op when Sentry is not configured.
 */
export async function captureMessage(
  msg: string,
  level: "info" | "warning" | "error" = "info",
): Promise<void> {
  const s = await getSentry();
  s?.captureMessage(msg, level);
}

/**
 * Set the user context for error reports.
 */
export async function setUser(
  user: { id: string; email?: string } | null,
): Promise<void> {
  const s = await getSentry();
  s?.setUser(user);
}

/** Whether Sentry is configured (DSN is set). */
export const sentryEnabled = !!DSN;
