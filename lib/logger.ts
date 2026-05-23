/**
 * Structured logger for API routes.
 *
 * - Development: pretty-printed with level tags.
 * - Production:  single-line JSON per entry (for log ingestion).
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("Request received", { path: "/api/foo" });
 *   log.error("Handler failed", err);
 */

const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  };

  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  if (isDev) {
    const tag = { debug: "\u{1F50D}", info: "ℹ️", warn: "⚠️", error: "\u{1F534}" }[level];
    fn(`${tag} [${level.toUpperCase()}] ${msg}`, ctx ?? "");
    return;
  }

  // Production: JSON line
  fn(JSON.stringify(entry));
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    emit("debug", msg, ctx),

  info: (msg: string, ctx?: Record<string, unknown>) =>
    emit("info", msg, ctx),

  warn: (msg: string, ctx?: Record<string, unknown>) =>
    emit("warn", msg, ctx),

  error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) => {
    const errCtx: Record<string, unknown> = { ...ctx };
    if (err instanceof Error) {
      errCtx.errorName = err.name;
      errCtx.errorMessage = err.message;
      if (isDev) errCtx.stack = err.stack;
    } else if (err !== undefined) {
      errCtx.errorRaw = String(err);
    }
    emit("error", msg, errCtx);
  },
};
