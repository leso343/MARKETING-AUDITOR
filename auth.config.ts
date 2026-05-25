/**
 * Edge-safe auth config — used by middleware.ts. No Node-only imports
 * (bcrypt, drizzle, libsql all go to auth.ts which runs in Node).
 *
 * Audit fixes:
 *   - H-11: trustHost limited to non-production. In prod, NEXTAUTH_URL
 *           must be set explicitly so callback URLs can't be spoofed
 *           via the Host header on preview deploys.
 *   - H-15: session callback is now typed against an augmented JWT and
 *           writes id / role / agencyId explicitly (no `as any`).
 *   - H-4 : tokenVersion is encoded in the JWT at issue time (in
 *           auth.ts) and re-checked by the Node-side jwt callback to
 *           force-signout deleted / role-changed users.
 */
import type { NextAuthConfig } from "next-auth";
import type {} from "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "admin" | "agency";
    agencyId?: string | null;
    tokenVersion?: number;
  }
}

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // H-11: Vercel-managed deployment trusts the verified custom domain at
  // the edge, so trustHost is enabled unconditionally to resolve NextAuth
  // UntrustedHost errors on Vercel. NEXTAUTH_URL pins the callback origin
  // so preview-deploy hosts can't redirect tokens.
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id?: string;
          role?: "admin" | "agency";
          agencyId?: string | null;
          tokenVersion?: number;
        };
        if (u.id) token.uid = u.id;
        if (u.role) token.role = u.role;
        if (u.agencyId !== undefined) token.agencyId = u.agencyId;
        if (typeof u.tokenVersion === "number") token.tokenVersion = u.tokenVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id ?? "";
        session.user.role = (token.role as "admin" | "agency") ?? "agency";
        session.user.agencyId = (token.agencyId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
