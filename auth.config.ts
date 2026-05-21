/**
 * Edge-safe auth config — used by middleware.ts. No Node-only imports
 * (bcrypt, drizzle, libsql all go to auth.ts which runs in Node).
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string; agencyId?: string | null };
        if (u.id) token.uid = u.id;
        if (u.role) token.role = u.role;
        if (u.agencyId !== undefined) token.agencyId = u.agencyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const su = session.user as any;
        su.id = token.uid as string;
        su.role = (token.role as string) ?? "agency";
        su.agencyId = (token.agencyId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
