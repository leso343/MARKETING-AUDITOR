/**
 * NextAuth v5 / auth.js — credentials provider, JWT sessions.
 *
 * Architecture:
 *   - auth.config.ts is the *edge-safe* config used by middleware.ts. It does
 *     NOT import bcryptjs (which uses Node-only setImmediate).
 *   - auth.ts (this file) extends that config with the Credentials provider
 *     which uses bcrypt + drizzle. Used by API routes and server components.
 *
 * We use JWT sessions (not DB sessions) so server components don't need a
 * session-table round-trip on every nav.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset we DO NOT call NextAuth() (it would throw at
 * module load). Instead we export shim implementations:
 *   - auth()                  → resolves to null (no session)
 *   - signIn() / signOut()    → no-op / throw a clear message
 *   - handlers.GET / .POST    → respond 503 "Auth disabled"
 *
 * Server components / API routes that import `auth` get a null session and
 * fall through to the legacy single-tenant code paths instead of 500-ing.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { authConfig } from "@/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "agency";
      agencyId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "agency";
    agencyId?: string | null;
  }
}

/** True when AUTH_SECRET is set. False → auth is shimmed (no-op). */
export const authEnabled: boolean = !!process.env.AUTH_SECRET;

type NextAuthExports = ReturnType<typeof NextAuth>;

let real: NextAuthExports | null = null;

if (authEnabled) {
  real = NextAuth({
    ...authConfig,
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(creds) {
          const email = String(creds?.email ?? "").trim().toLowerCase();
          const password = String(creds?.password ?? "");
          if (!email || !password) return null;

          // If DB is unavailable, login is impossible — refuse cleanly.
          if (!dbAvailable) return null;

          const rows = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);
          const user = rows[0];
          if (!user || !user.passwordHash) return null;

          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            role: user.role as "admin" | "agency",
            agencyId: user.agencyId,
          };
        },
      }),
    ],
  });
}

const disabledResponse = () =>
  new Response(
    JSON.stringify({
      error:
        "Auth disabled — set AUTH_SECRET in the environment to enable multi-tenant features.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );

export const handlers = real?.handlers ?? {
  GET: async () => disabledResponse(),
  POST: async () => disabledResponse(),
};

/**
 * Returns the current session or null. Callers checking `session?.user` will
 * naturally branch to the no-auth path when auth is disabled.
 */
export const auth: NextAuthExports["auth"] =
  real?.auth ?? (((..._args: unknown[]) => Promise.resolve(null)) as unknown as NextAuthExports["auth"]);

export const signIn: NextAuthExports["signIn"] =
  real?.signIn ??
  (((..._args: unknown[]) => {
    throw new Error(
      "Auth disabled — set AUTH_SECRET in the environment to enable sign-in.",
    );
  }) as unknown as NextAuthExports["signIn"]);

export const signOut: NextAuthExports["signOut"] =
  real?.signOut ??
  (((..._args: unknown[]) => Promise.resolve(undefined)) as unknown as NextAuthExports["signOut"]);
