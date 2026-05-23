"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";

export default function NewAgencyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#ff0000");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setSlug("");
    setPrimaryColor("#ff0000");
    setError(null);
    setOpen(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          primaryColor,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      reset();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="panel flex w-full items-center justify-center gap-2 py-4 text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-white"
      >
        <Plus className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          Create new agency
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="panel-label mb-0">New agency</div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Agency name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            placeholder="SNA Digital"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            URL slug <span className="opacity-50">(optional)</span>
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto from name"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Brand color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono text-[var(--red)] flex items-center gap-1.5">
          <X className="h-3 w-3" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        {pending ? "Creating..." : "Create agency"}
      </button>
    </form>
  );
}
