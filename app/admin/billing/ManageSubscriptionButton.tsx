"use client";
import { useState, useTransition } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";

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
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ExternalLink className="h-3.5 w-3.5" />
        )}
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error && (
        <div className="mt-2 flex items-center gap-1.5 rounded bg-red-500/10 px-2.5 py-1.5">
          <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
          <span className="text-[9px] font-mono text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}
