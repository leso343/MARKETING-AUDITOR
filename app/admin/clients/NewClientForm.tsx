"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [industry, setIndustry] = useState("roofing");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || undefined, subtitle: subtitle || undefined, industry }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      const j = await res.json();
      router.push(`/admin/clients/${j.slug}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-3">
      <div className="panel-label">Create new client</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
            placeholder="Acme Roofing"
            className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Slug (optional)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-roofing"
            className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Subtitle</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Roofing · Florida · Storm leads"
            className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Industry</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none">
            <option value="roofing">Roofing</option>
            <option value="hvac">HVAC</option>
            <option value="solar">Solar</option>
            <option value="dental">Dental</option>
            <option value="legal">Legal</option>
            <option value="ecommerce">E-commerce</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      {error && <div className="text-xs text-[var(--red)] font-mono">{error}</div>}
      <button type="submit" disabled={pending}
        className="bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90 disabled:opacity-50">
        {pending ? "Creating…" : "Create client"}
      </button>
    </form>
  );
}
