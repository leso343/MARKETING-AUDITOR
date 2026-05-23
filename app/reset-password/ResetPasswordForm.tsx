"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!token) {
    return (
      <div className="panel text-center py-8 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
          <AlertTriangle className="h-6 w-6 text-[var(--red)]" />
        </div>
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Invalid reset link
        </h2>
        <p className="text-sm text-[var(--text-dim)]">
          This link is missing a reset token. Please request a new password
          reset from the login page.
        </p>
        <Link
          href="/login"
          className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
        >
          Back to login
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="panel text-center py-8 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Password updated
        </h2>
        <p className="text-sm text-[var(--text-dim)]">
          Your password has been reset. You can now sign in with your new
          password.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest py-2.5 hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return;
        }
        setDone(true);
      } catch {
        setError("Network error — try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="h-4 w-4 text-[var(--red)]" />
        <span
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Choose a new password
        </span>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          New password
        </label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Confirm password
        </label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
      </div>

      {error && (
        <div className="text-xs text-[var(--red)] font-mono">{error}</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest py-3 hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
