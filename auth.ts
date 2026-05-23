/**
 * NextAuth v5 / auth.js — credentials provider, JWT sessions.
 *
 * Architecture:
 *   - auth.config.ts is the *edge-safe* config used by middleware.ts. It does
 *     NOT import bcryptjs (which uses Node-only setImmediate).
 *   - auth.ts (this file) extends that config with the Credentials provider
 *     which uses bcrypt + drizzle. Used by API routes and server components.
 *
 * H-4 fix — JWT revocation:
 *   Every JWT carries `tokenVersion`. On each request, the Node-side `jwt`
 *   callback re-reads the user's current `tokenVersion` from the DB and
 *   invalidates the token (returns null) when:
 *     - the user no longer exists, OR
 *     - their `tokenVersion` has been bumped (admin deleted them, changed
 *       their agency, demoted them, etc.).
 *
 *   The DB lookup is fast (single indexed row by id) and only runs when
 *   AUTH_SECRET is set. In legacy mode this whole file shims to no-ops.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset we DO NOT call NextAuth() (it would throw at
 * module load). Instead we export shim implementations:
 *   - auth()                  → resolves to null (no session)
 *   - signIn() / signOut()    → no-op / throw a clear message
 *   - handlers.GET / .POST    → respond 503 "Auth disabled"
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
    tokenVersion?: number;
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
            tokenVersion: user.tokenVersion ?? 0,
          };
        },
      }),
    ],
    callbacks: {
      ...authConfig.callbacks,
      /**
       * H-4: re-verify the user against the DB on every request.
       * Returns null when the user no longer exists or has been
       * invalidated by an admin (tokenVersion bumped).
       */
      async jwt({ token, user, trigger }) {
        // Sign-in path — hydrate from `user`.
        if (user) {
          const merged = await authConfig.callbacks!.jwt!({ token, user, trigger } as never);
          return merged ?? token;
        }

        if (!dbAvailable) return token;
        const uid = token.uid;
        if (typeof uid !== "string" || !uid) return token;

        try {
          const rows = await db
            .select({
              id: schema.users.id,
              role: schema.users.role,
              agencyId: schema.users.agencyId,
              tokenVersion: schema.users.tokenVersion,
            })
            .from(schema.users)
            .where(eq(schema.users.id, uid))
            .limit(1);
          const current = rows[0];

          // User deleted → invalidate.
          if (!current) return null;

          // tokenVersion bumped (delete / role / agency change) → invalidate.
          if ((token.tokenVersion ?? 0) !== (current.tokenVersion ?? 0)) return null;

          // Sync any drift in role / agency.
          token.role = current.role as "admin" | "agency";
          token.agencyId = current.agencyId ?? null;
          return token;
        } catch {
          // DB blip — keep the token rather than locking everyone out.
          return token;
        }
      },
    },
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

/**
 * Bump a user's token version — forces all of their existing JWTs to be
 * invalidated on the next request. Call this whenever you delete a
 * user, change their role, or move them to a different agency.
 */
export async function bumpTokenVersion(userId: string): Promise<void> {
  if (!dbAvailable) return;
  try {
    const rows = await db
      .select({ tokenVersion: schema.users.tokenVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const current = rows[0]?.tokenVersion ?? 0;
    await db
      .update(schema.users)
      .set({ tokenVersion: current + 1 })
      .where(eq(schema.users.id, userId));
  } catch {
    /* best-effort */
  }
}
