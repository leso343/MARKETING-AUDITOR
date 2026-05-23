/**
 * Auth gate (edge runtime).
 *
 * Uses the lighter auth.config (no bcrypt / drizzle) so it can run on the edge.
 * Unauthenticated users hitting / or /audit/* or /admin/* land on /login.
 *
 * Audit fixes:
 *   - C-8 / H-10: /reset-password, /forgot-password, /legal must be
 *     reachable without a session (password-reset email link; public
 *     privacy/TOS pages required for GDPR + Stripe).
 *   - C-1: /signup is the new public account-creation flow.
 *   - H-16: the previous `pathname.startsWith(p)` matcher made
 *     `/login-anything` inherit `/login`'s public status. Tightened to
 *     `=== p || startsWith(p + "/")`.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ENABLED = !!process.env.AUTH_SECRET;

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/legal",
  "/api/auth",
  "/api/billing/webhook",
  "/api/logos",
  "/_next",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true;
    if (pathname.startsWith(p + "/")) return true;
  }
  // Static assets served under /logos/* and /csvs/* — open for legacy
  // filesystem-served logos and the public bundled CSVs.
  if (pathname.startsWith("/logos/") || pathname.startsWith("/csvs/")) return true;
  return false;
}

type AuthedRequest = NextRequest & { auth: unknown };

const gatedHandler = (req: AuthedRequest) => {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
};

const passThrough = () => NextResponse.next();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const middleware: any = AUTH_ENABLED
  ? NextAuth(authConfig).auth(gatedHandler as never)
  : passThrough;

export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
