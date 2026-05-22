"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          subtitle: subtitle || undefined,
          industry,
        }),
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="panel flex w-full items-center justify-center gap-2 py-4 text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-white"
      >
        <Plus className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-widest">
          Add new client
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="panel-label">New client</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            Client name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            placeholder="Acme Roofing"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            URL name
            <span className="text-[var(--text-dim)]/60 ml-1">(optional)</span>
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated from name"
            className="w-full bg-black border border-[var(--border)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            Subtitle
          </label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Roofing · Florida · Storm leads"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            Industry
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          >
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

      {error && <div className="text-xs font-mono text-[var(--red)]">{error}</div>}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
      >
        <Plus className="h-3 w-3" />
        {pending ? "Creating…" : "Create client"}
      </button>
    </form>
  );
}
