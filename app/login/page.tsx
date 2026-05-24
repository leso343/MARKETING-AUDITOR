import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { authEnabled } from "@/auth";
import Logo from "@/components/Logo";
import ParticleNetwork from "./ParticleNetwork";

export const metadata: Metadata = {
  title: "Sign in — Blank Page Audits",
  description: "Sign in to access your forensic ad audit dashboards.",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main id="main-content" className="login-split">
      {/* ── Left: hero panel ── */}
      <div className="login-split__hero">
        <div className="login-split__canvas">
          <ParticleNetwork />
        </div>

        {/* Radial glow behind content */}
        <div className="login-split__glow" />

        <div className="login-split__hero-content">
          <div className="login-split__hero-badge">
            <span className="login-split__badge-dot" />
            AI-Powered Forensic Engine
          </div>

          <h2 className="login-split__hero-title">
            Your clients spend
            <br />
            thousands on ads.
            <br />
            <span className="text-[#ff3c3c]">Show them where it went.</span>
          </h2>

          <p className="login-split__hero-sub">
            AI-driven forensic analysis that catches what humans
            miss. Every dollar tracked. Every leak surfaced.
            Reports that turn skeptics into believers.
          </p>

          <div className="login-split__hero-stats">
            <div className="login-split__stat">
              <span className="login-split__stat-num">200<span className="text-[#ff3c3c] text-[16px]">+</span></span>
              <span className="login-split__stat-label">Signals per audit</span>
            </div>
            <div className="login-split__stat-divider" />
            <div className="login-split__stat">
              <span className="login-split__stat-num">&lt;60<span className="text-[#ff3c3c] text-[12px] ml-0.5">s</span></span>
              <span className="login-split__stat-label">AI analysis time</span>
            </div>
            <div className="login-split__stat-divider" />
            <div className="login-split__stat">
              <span className="login-split__stat-num">3</span>
              <span className="login-split__stat-label">Platform integrations</span>
            </div>
          </div>
        </div>

        {/* Bottom brand mark */}
        <div className="login-split__hero-footer">
          <Logo size="sm" showText={false} />
          <span className="font-mono text-[9px] uppercase tracking-[2px] text-white/30 ml-3">
            Blank Page Audits
          </span>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="login-split__form-panel">
        <div className="login-split__form-inner">
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <Logo size="md" />
            </div>

            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              Sign in to your account to continue.
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
                &larr; Back to dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
