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
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
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
