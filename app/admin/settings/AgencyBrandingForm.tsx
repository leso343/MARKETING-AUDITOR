"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  agencyId: string;
  defaults: { name: string; logoUrl: string; primaryColor: string };
}

export default function AgencyBrandingForm({ agencyId, defaults }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaults.name);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch(`/api/agency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, name, logoUrl: logoUrl || null, primaryColor }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      setInfo("Saved.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-4">
      <div className="panel-label">Branding</div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Agency name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none" />
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Logo URL</label>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/logos/agency.png or https://…"
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none" />
        <p className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">
          Upload via the existing /setup → Agency Branding flow, or paste a CDN URL here.
        </p>
      </div>
      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Primary color</label>
        <div className="flex items-center gap-3">
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-16 bg-transparent border border-[var(--border)] cursor-pointer" />
          <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
            className="flex-1 bg-black border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none" />
        </div>
      </div>
      {error && <div className="text-xs font-mono text-[var(--red)]">{error}</div>}
      {info && <div className="text-xs font-mono text-emerald-400">{info}</div>}
      <button type="submit" disabled={pending}
        className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90 disabled:opacity-50">
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
