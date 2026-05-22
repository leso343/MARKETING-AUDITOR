"use client";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    if (currentPassword === newPassword) {
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
        <div className="panel-label">Change password</div>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
          Current password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
          New password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
        <p className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">
          Minimum 8 characters
        </p>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
        />
      </div>

      {error && <div className="text-xs font-mono text-[var(--red)]">{error}</div>}
      {success && <div className="text-xs font-mono text-emerald-400">{success}</div>}

      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
