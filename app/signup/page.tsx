/**
 * /signup — create a new account. Fixes C-1.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import SignupForm from "./SignupForm";
import { authEnabled } from "@/auth";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Create your account — Blank Page Audits",
  description: "Start your free 14-day trial of Blank Page Audits.",
};

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" className="mb-6" />
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
            &gt; Blank Page Audits / Sign up
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Start your free trial
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            14 days, no credit card.
          </p>
        </div>

        {authEnabled ? (
          <Suspense>
            <SignupForm />
          </Suspense>
        ) : (
          <div className="panel space-y-4 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[3px] text-amber-500">
              &gt; Signup disabled
            </div>
            <p className="text-sm text-[var(--text-dim)]">
              This deployment is in legacy single-tenant mode — signup
              requires <code>AUTH_SECRET</code> and <code>DATABASE_URL</code>.
            </p>
            <Link
              href="/"
              className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
            >
              ← Back to dashboard
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--text)] hover:text-[var(--red)]">
            Sign in &rarr;
          </Link>
        </p>
      </div>
    </main>
  );
}
