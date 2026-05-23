"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  AlertTriangle,
  Palette,
  Globe,
} from "lucide-react";

type Agency = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  highlightColor: string | null;
  popColor: string | null;
  createdAt: Date;
};

type Props = {
  agency: Agency;
  clientCount: number;
  userCount: number;
};

export default function AgencyCard({ agency, clientCount, userCount }: Props) {
  const router = useRouter();

  // Edit state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agency.name);
  const [logoUrl, setLogoUrl] = useState(agency.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, startSave] = useTransition();

  // Delete state
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pendingDelete, startDelete] = useTransition();

  const colors = [
    agency.primaryColor ?? "#ff0000",
    agency.secondaryColor,
    agency.accentColor,
    agency.highlightColor,
    agency.popColor,
  ].filter(Boolean) as string[];

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await fetch("/api/agencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: agency.id,
          name: name.trim() || undefined,
          logoUrl: logoUrl.trim() || null,
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

  const onDelete = () => {
    if (typed.trim().toLowerCase() !== agency.slug.toLowerCase()) return;
    setError(null);
    startDelete(async () => {
      const res = await fetch(`/api/agencies?agencyId=${encodeURIComponent(agency.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  };

  // ── Delete confirmation ──────────────────────────
  if (confirming) {
    return (
      <div className="panel border-red-500/30 bg-red-500/[0.03] space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-red-400 text-sm">
              Delete &ldquo;{agency.name}&rdquo;?
            </div>
            <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">
              This deletes the agency and <strong>all {clientCount} client{clientCount !== 1 ? "s" : ""}</strong> with their CSV data.
              Users will be unlinked. This cannot be undone.
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
            Type <span className="text-red-400 font-bold">{agency.slug}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={agency.slug}
            autoFocus
            className="w-full bg-[var(--bg)] border border-red-500/30 rounded px-3 py-2 text-sm font-mono focus:border-red-500 outline-none transition-colors"
          />
        </div>

        {error && (
          <div className="text-xs font-mono text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onDelete}
            disabled={pendingDelete || typed.trim().toLowerCase() !== agency.slug.toLowerCase()}
            className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-40 transition-all"
          >
            {pendingDelete ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {pendingDelete ? "Deleting..." : "Delete permanently"}
          </button>
          <button
            onClick={() => { setConfirming(false); setTyped(""); }}
            disabled={pendingDelete}
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Edit mode ────────────────────────────────────
  if (editing) {
    return (
      <div className="panel space-y-4 border-[var(--red)]/30">
        <div className="flex items-center justify-between">
          <div className="panel-label mb-0 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-[var(--red)]" />
            Edit agency
          </div>
          <button
            onClick={() => { setEditing(false); setName(agency.name); setLogoUrl(agency.logoUrl ?? ""); setError(null); }}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
              Agency name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
              Logo URL
            </label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs font-mono text-[var(--red)] flex items-center gap-1.5">
            <X className="h-3 w-3" /> {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={pendingSave || name.trim().length < 2}
            className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {pendingSave ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {pendingSave ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={pendingSave}
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Default card view ────────────────────────────
  return (
    <div className="panel group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {agency.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agency.logoUrl} alt={agency.name} className="h-10 w-10 rounded border border-[var(--border)] object-contain p-1" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded border border-[var(--border)]"
              style={{ background: `${agency.primaryColor ?? "#ff0000"}15` }}
            >
              <Building2 className="h-4 w-4" style={{ color: agency.primaryColor ?? "var(--red)" }} />
            </div>
          )}
          <div>
            <div className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
              {agency.name}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              /{agency.slug}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--red)] transition-all"
          >
            <Pencil className="h-2.5 w-2.5" />
            Edit
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:border-red-500 hover:text-red-400 transition-all"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-center">
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {clientCount}
          </div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
            Clients
          </div>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-center">
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {userCount}
          </div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
            Users
          </div>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-center">
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {colors.length}
          </div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
            Colors
          </div>
        </div>
      </div>

      {/* color palette */}
      <div className="mb-3">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5 flex items-center gap-1.5">
          <Palette className="h-2.5 w-2.5" />
          Brand palette
        </div>
        <div className="flex gap-1">
          {colors.map((c, i) => (
            <div
              key={i}
              className="h-6 flex-1 rounded-sm border border-white/10 transition-transform hover:scale-110"
              style={{ background: c }}
              title={c}
            />
          ))}
          {colors.length < 5 &&
            Array.from({ length: 5 - colors.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-6 flex-1 rounded-sm border border-dashed border-[var(--border)]"
              />
            ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[var(--text-dim)] pt-2 border-t border-[var(--border)]">
        <span className="font-mono text-[9px] uppercase tracking-wider">
          Created {new Date(agency.createdAt).toLocaleDateString()}
        </span>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-white/10"
          style={{ background: agency.primaryColor ?? "#ff0000", boxShadow: `0 0 8px ${agency.primaryColor ?? "#ff0000"}40` }}
        />
      </div>
    </div>
  );
}
