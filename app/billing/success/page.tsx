/**
 * /billing/success — landing page after a successful Stripe Checkout redirect.
 *
 * Reads ?session_id=cs_... from the URL, calls /api/billing/verify, shows
 * a confirmation, and links the user to /admin.
 *
 * Renders client-side because we need access to the search params and we
 * want to surface the verify call's loading / error states inline.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type VerifyResult =
  | { ok: true; tier: string; status: string; currentPeriodEnd: string | null }
  | { ok: false; error?: string; paymentStatus?: string; status?: string };

export default function BillingSuccessPage() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) {
      setState("error");
      setErrorMsg("Missing session_id in URL.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`,
        );
        const j = (await res.json().catch(() => ({}))) as VerifyResult & {
          error?: string;
        };
        if (!res.ok || !(j as { ok?: boolean }).ok) {
          setState("error");
          setErrorMsg(
            (j as { error?: string }).error ??
              `Verification failed (HTTP ${res.status}).`,
          );
          setResult(j);
          return;
        }
        setState("ok");
        setResult(j);
      } catch (err) {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Network error.");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen p-6 sm:p-12 lg:p-16">
      <div className="max-w-xl mx-auto">
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-3">
          &gt; SNA_Forensic / Billing / Success
        </div>

        {state === "loading" && (
          <div className="panel space-y-3">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
              Verifying payment…
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              Stripe is confirming your checkout session. This usually takes a second.
            </p>
          </div>
        )}

        {state === "ok" && result && "ok" in result && result.ok && (
          <div className="panel space-y-4 border-[var(--red)]">
            <div className="panel-label">Subscription active</div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
              You&apos;re subscribed to the {result.tier === "agency" ? "Agency" : "Pro"} plan.
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              Payment confirmed. Status: <span className="font-mono">{result.status}</span>.
              {result.currentPeriodEnd ? (
                <>
                  {" "}Next billing:{" "}
                  <span className="font-mono">
                    {new Date(result.currentPeriodEnd).toLocaleDateString()}
                  </span>
                  .
                </>
              ) : null}
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/admin"
                className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
              >
                Go to dashboard →
              </Link>
              <Link
                href="/admin/billing"
                className="border border-[var(--border)] hover:border-[var(--red)] font-mono text-xs uppercase tracking-widest px-4 py-2"
              >
                Manage billing
              </Link>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="panel space-y-3 border-[var(--red)]">
            <div className="panel-label">Verification failed</div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
              We couldn&apos;t verify your subscription.
            </h1>
            <p className="text-sm text-[var(--text-dim)]">
              {errorMsg ??
                "Something went wrong while checking with Stripe. Your card may not have been charged."}
            </p>
            <p className="text-xs font-mono text-[var(--text-dim)]">
              If you were charged, contact support — we&apos;ll reconcile manually.
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/pricing"
                className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
              >
                Back to pricing
              </Link>
              <Link
                href="/"
                className="border border-[var(--border)] hover:border-[var(--red)] font-mono text-xs uppercase tracking-widest px-4 py-2"
              >
                Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
