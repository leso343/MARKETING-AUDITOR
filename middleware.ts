/**
 * Auth gate (edge runtime).
 *
 * Uses the lighter auth.config (no bcrypt / drizzle) so it can run on the edge.
 * Unauthenticated users hitting / or /audit/* or /admin/* land on /login.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/pricing",
  "/api/auth",
  "/_next",
  "/favicon",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) {
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
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
