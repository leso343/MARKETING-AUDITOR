"use client";
import { useState, useTransition } from "react";

export default function ManageSubscriptionButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.url) {
          window.location.href = j.url as string;
          return;
        }
        setError(j.error ?? `Portal failed (HTTP ${res.status}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  };

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Opening portal…" : "Manage subscription"}
      </button>
      {error && (
        <span className="mt-2 text-[10px] font-mono text-[var(--red)]">{error}</span>
      )}
    </div>
  );
}
