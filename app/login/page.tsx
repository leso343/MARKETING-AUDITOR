/**
 * /login — credentials sign-in.
 *
 * On success the user lands on /, which renders the agency-scoped client list.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset the credentials provider is shimmed and would
 * just throw on submit. Show a clear notice + a link back to "/" (legacy
 * single-tenant mode) instead.
 */
import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { authEnabled } from "@/auth";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" className="mb-6" />
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
            &gt; Blank Page Audits / Login
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Access your client audits.
          </p>
        </div>

        {authEnabled ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <div className="panel space-y-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[3px] text-amber-500">
              &gt; Auth disabled
            </div>
            <p className="text-sm text-[var(--text-dim)]">
              This deployment is in legacy single-tenant mode — sign-in is
              not configured. Set <code>AUTH_SECRET</code> (and{" "}
              <code>DATABASE_URL</code>) in the environment to enable
              multi-tenant auth.
            </p>
            <Link
              href="/"
              className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
            >
              ← Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
