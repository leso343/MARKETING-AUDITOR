"use client";
import { useState, useTransition } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={label.toLowerCase().includes("current") ? 1 : 8}
          placeholder={placeholder}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2.5 pr-10 text-sm focus:border-[var(--red)] outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-white transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && (
        <p className="mt-1 text-[9px] font-mono text-[var(--text-dim)]">{hint}</p>
      )}
    </div>
  );
}

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // live validation hints
  const hasLength = newPassword.length >= 8;
  const hasMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isDifferent = newPassword.length > 0 && currentPassword !== newPassword;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasLength) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (!hasMatch) {
      setError("New passwords don't match.");
      return;
    }
    if (!isDifferent) {
      setError("New password must be different from current password.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }

      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-5">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-[var(--red)]" />
        <div className="panel-label mb-0">Change password</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="••••••••"
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="••••••••"
          hint="Minimum 8 characters"
        />
        <PasswordInput
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
        />
      </div>

      {/* live validation checklist */}
      {(newPassword.length > 0 || confirmPassword.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {[
            { ok: hasLength, label: "8+ characters" },
            { ok: hasMatch, label: "Passwords match" },
            { ok: isDifferent, label: "Different from current" },
          ].map((check) => (
            <div
              key={check.label}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider"
            >
              {check.ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-[var(--text-dim)]" />
              )}
              <span className={check.ok ? "text-emerald-400" : "text-[var(--text-dim)]"}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* status messages */}
      {error && (
        <div className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="text-xs font-mono text-red-400">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-3 py-2">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">{success}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !hasLength || !hasMatch || !isDifferent}
        className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2.5 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-30 transition-all"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        )}
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
