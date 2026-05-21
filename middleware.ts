/**
 * Auth gate (edge runtime).
 *
 * Uses the lighter auth.config (no bcrypt / drizzle) so it can run on the edge.
 * Unauthenticated users hitting / or /audit/* or /admin/* land on /login.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset we DO NOT initialize NextAuth (it would throw on
 * the edge). The middleware becomes a pass-through, and the app runs in
 * single-tenant / no-auth (legacy filesystem) mode. Set AUTH_SECRET to
 * re-enable the auth gate.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_ENABLED = !!process.env.AUTH_SECRET;

const PUBLIC_PATHS = [
  "/login",
  "/pricing",
  "/api/auth",
  "/_next",
  "/favicon",
];

type AuthedRequest = NextRequest & { auth: unknown };

const gatedHandler = (req: AuthedRequest) => {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some(
      (p) =>
        pathname === p ||
        pathname.startsWith(p + "/") ||
        pathname.startsWith(p),
    )
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/logos") || pathname.startsWith("/csvs")) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
};

// When AUTH_SECRET is unset, export a no-op middleware so the deployment
// boots cleanly (no NextAuth init, no thrown "missing secret" error).
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
