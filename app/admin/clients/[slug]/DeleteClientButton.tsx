"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle, X } from "lucide-react";

type Props = {
  clientId: string;
  clientName: string;
  clientSlug: string;
};

export default function DeleteClientButton({ clientId, clientName, clientSlug }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matchesSlug = typed.trim().toLowerCase() === clientSlug.toLowerCase();

  const onDelete = () => {
    if (!matchesSlug) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/clients?clientId=${encodeURIComponent(clientId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.push("/admin/clients");
      router.refresh();
    });
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-red-500 hover:text-red-400 hover:bg-red-500/5"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    );
  }

  return (
    <div className="panel border-red-500/30 bg-red-500/[0.03] space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-red-400 text-sm">
            Delete &ldquo;{clientName}&rdquo;?
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
            This will permanently delete the client and <strong>all uploaded CSV files</strong>.
            This action cannot be undone.
          </p>
        </div>
        <button
          onClick={() => { setConfirming(false); setTyped(""); setError(null); }}
          className="text-[var(--text-dim)] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
          Type <span className="text-red-400 font-bold">{clientSlug}</span> to confirm
        </label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={clientSlug}
          autoFocus
          className="w-full bg-[var(--bg)] border border-red-500/30 rounded px-3 py-2 text-sm font-mono focus:border-red-500 outline-none transition-colors"
        />
      </div>

      {error && (
        <div className="text-xs font-mono text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onDelete}
          disabled={pending || !matchesSlug}
          className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 transition-all"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          {pending ? "Deleting..." : "Delete permanently"}
        </button>
        <button
          onClick={() => { setConfirming(false); setTyped(""); setError(null); }}
          disabled={pending}
          className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
