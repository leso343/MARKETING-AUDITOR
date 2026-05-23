"use client";

import { useState, useTransition } from "react";
import { X, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

/**
 * Password reset flow — Step 1: Request reset link.
 *
 * Since this is a B2B SaaS with agency admins, the reset flow is:
 *   1. User enters email
 *   2. POST /api/auth/forgot-password
 *   3. Server generates a time-limited token, stores hash in DB
 *   4. Sends email with reset link (requires SMTP config)
 *
 * For MVP: if SMTP is not configured, we show a "contact admin" fallback.
 */
export default function ForgotPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return;
        }
        setSent(true);
      } catch {
        setError("Network error — try again.");
      }
    });
  };

  const handleClose = () => {
    setEmail("");
    setSent(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="panel w-full max-w-sm relative">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {sent ? (
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-head)" }}
              >
                Check your email
              </h2>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                If an account exists for <strong className="text-[var(--text)]">{email}</strong>,
                we&apos;ve sent a password reset link. It expires in 1 hour.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest py-2.5 hover:opacity-90"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4 text-[var(--red)]" />
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "var(--font-head)" }}
              >
                Reset password
              </h2>
            </div>
            <p className="text-sm text-[var(--text-dim)] mb-5">
              Enter your email address and we&apos;ll send you a link to reset your
              password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none placeholder:text-[var(--text-dim)]/40"
                />
              </div>

              {error && (
                <div className="text-xs text-[var(--red)] font-mono">{error}</div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest py-2.5 hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <button
              onClick={handleClose}
              className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors py-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
