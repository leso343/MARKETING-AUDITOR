"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check, Loader2 } from "lucide-react";

type Props = {
  clientId: string;
  currentName: string;
  currentSubtitle: string | null;
  currentIndustry: string | null;
};

const INDUSTRIES = [
  { value: "roofing", label: "Roofing" },
  { value: "hvac", label: "HVAC" },
  { value: "solar", label: "Solar" },
  { value: "dental", label: "Dental" },
  { value: "legal", label: "Legal" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "real-estate", label: "Real Estate" },
  { value: "plumbing", label: "Plumbing" },
  { value: "landscaping", label: "Landscaping" },
  { value: "other", label: "Other" },
];

export default function EditClientForm({
  clientId,
  currentName,
  currentSubtitle,
  currentIndustry,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [subtitle, setSubtitle] = useState(currentSubtitle ?? "");
  const [industry, setIndustry] = useState(currentIndustry ?? "roofing");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName(currentName);
    setSubtitle(currentSubtitle ?? "");
    setIndustry(currentIndustry ?? "roofing");
    setError(null);
    setEditing(false);
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name: name.trim() || undefined,
          subtitle: subtitle.trim() || null,
          industry: industry || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
    );
  }

  return (
    <div className="panel space-y-4 border-[var(--red)]/30">
      <div className="flex items-center justify-between">
        <div className="panel-label mb-0 flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-[var(--red)]" />
          Edit client
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Client name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            placeholder="Client name"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Industry
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none transition-colors"
          >
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Subtitle
          </label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Roofing · Florida · Storm leads"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono text-[var(--red)] flex items-center gap-1.5">
          <X className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={pending || name.trim().length < 2}
          className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          onClick={reset}
          disabled={pending}
          className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
