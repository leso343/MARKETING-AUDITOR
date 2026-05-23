/**
 * Shared helpers for API route handlers.
 *
 * - M-1: Origin/Referer check to defeat CSRF on state-changing routes
 *        (SameSite=Lax on the NextAuth cookie helps but Safari is laxer).
 * - M-9: parseJsonBody() caps request size before JSON.parse runs, so a
 *        100 MB POST doesn't OOM the function.
 * - M-19: genericError() returns a stable shape; callers should use this
 *        for any internal/SDK error rather than echoing err.message.
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/logger";

const DEFAULT_MAX_BYTES = 64 * 1024;

/** True when the request Origin/Referer matches our configured app origin. */
export function isSameOriginRequest(req: Request): boolean {
  const allowedOrigins = new Set<string>();
  for (const v of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL]) {
    if (v) {
      try {
        allowedOrigins.add(new URL(v).origin);
      } catch {
        /* ignore malformed env */
      }
    }
  }
  // In dev / no-config deploys, allow localhost variants.
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
  }
  // Allow requests originating from the same Host header (preview deploys).
  const host = req.headers.get("host");
  if (host) {
    allowedOrigins.add(`https://${host}`);
    allowedOrigins.add(`http://${host}`);
  }

  const origin = req.headers.get("origin");
  if (origin && allowedOrigins.has(origin)) return true;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const r = new URL(referer);
      if (allowedOrigins.has(r.origin)) return true;
    } catch {
      /* ignore */
    }
  }

  // No Origin AND no Referer is suspicious for a state-changing call,
  // but legitimate same-origin XHR from older browsers won't always
  // send Origin. Allow in non-production; refuse in production.
  if (!origin && !referer) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
}

/** Returns a 403 NextResponse for a CSRF-fail. */
export function csrfRejection(): NextResponse {
  return NextResponse.json(
    { error: "Cross-site request blocked." },
    { status: 403 },
  );
}

/**
 * Read and JSON-parse a request body with a hard byte cap. Returns
 * { ok: true, data } or { ok: false, status, error } — caller decides
 * how to surface the failure.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  { maxBytes = DEFAULT_MAX_BYTES }: { maxBytes?: number } = {},
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }
> {
  const lenHdr = Number(req.headers.get("content-length") ?? "0");
  if (lenHdr && lenHdr > maxBytes) {
    return { ok: false, status: 413, error: "Request body too large." };
  }
  // Read the body once. Note that consuming the body invalidates
  // formData() / json() called later, so callers shouldn't mix.
  let text: string;
  try {
    text = await req.text();
  } catch (err) {
    log.warn("parseJsonBody: read failed", { error: String(err) });
    return { ok: false, status: 400, error: "Could not read request body." };
  }
  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: "Request body too large." };
  }
  if (!text) {
    return { ok: true, data: {} as T };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}

/** Standard generic error JSON — for use when echoing internal/SDK messages would leak. */
export function genericError(
  publicMessage: string,
  status = 500,
  errorId?: string,
): NextResponse {
  const body: Record<string, unknown> = { error: publicMessage };
  if (errorId) body.errorId = errorId;
  return NextResponse.json(body, { status });
}
