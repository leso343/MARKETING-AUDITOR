"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette, Sparkles } from "lucide-react";

interface Props {
  agencyId: string;
  defaults: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    highlightColor: string;
    popColor: string;
  };
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/* ── 24 preset palettes (4 rows × 6) ────────────────────────────────── */

type Preset = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  pop: string;
};

const PRESETS: Preset[] = [
  // Row 1 — clean & corporate
  { name: "Crimson",     primary: "#ff0000", secondary: "#ff4444", accent: "#cc0000", highlight: "#ff6b35", pop: "#ffd700"    },
  { name: "Ocean",       primary: "#0ea5e9", secondary: "#38bdf8", accent: "#0284c7", highlight: "#06d6a0", pop: "#ffd166"    },
  { name: "Emerald",     primary: "#10b981", secondary: "#34d399", accent: "#059669", highlight: "#f472b6", pop: "#fbbf24"    },
  { name: "Violet",      primary: "#8b5cf6", secondary: "#a78bfa", accent: "#7c3aed", highlight: "#f97316", pop: "#22d3ee"    },
  { name: "Sunset",      primary: "#f97316", secondary: "#fb923c", accent: "#ea580c", highlight: "#a78bfa", pop: "#34d399"    },
  { name: "Rose",        primary: "#f43f5e", secondary: "#fb7185", accent: "#e11d48", highlight: "#38bdf8", pop: "#a3e635"    },

  // Row 2 — bold & energetic
  { name: "Amber",       primary: "#f59e0b", secondary: "#fbbf24", accent: "#d97706", highlight: "#ef4444", pop: "#8b5cf6"    },
  { name: "Cyan",        primary: "#06b6d4", secondary: "#22d3ee", accent: "#0891b2", highlight: "#f43f5e", pop: "#fbbf24"    },
  { name: "Fuchsia",     primary: "#d946ef", secondary: "#e879f9", accent: "#c026d3", highlight: "#22d3ee", pop: "#84cc16"    },
  { name: "Lime",        primary: "#84cc16", secondary: "#a3e635", accent: "#65a30d", highlight: "#f472b6", pop: "#818cf8"    },
  { name: "Slate",       primary: "#64748b", secondary: "#94a3b8", accent: "#475569", highlight: "#f97316", pop: "#22d3ee"    },
  { name: "Gold",        primary: "#eab308", secondary: "#facc15", accent: "#ca8a04", highlight: "#ef4444", pop: "#a855f7"    },

  // Row 3 — moody & premium
  { name: "Midnight",    primary: "#6366f1", secondary: "#818cf8", accent: "#4f46e5", highlight: "#fb923c", pop: "#4ade80"    },
  { name: "Ember",       primary: "#dc2626", secondary: "#ef4444", accent: "#b91c1c", highlight: "#fbbf24", pop: "#34d399"    },
  { name: "Teal",        primary: "#14b8a6", secondary: "#2dd4bf", accent: "#0d9488", highlight: "#e879f9", pop: "#fb923c"    },
  { name: "Wine",        primary: "#9f1239", secondary: "#be123c", accent: "#881337", highlight: "#fbbf24", pop: "#38bdf8"    },
  { name: "Storm",       primary: "#6b7280", secondary: "#9ca3af", accent: "#4b5563", highlight: "#f43f5e", pop: "#a78bfa"    },
  { name: "Forest",      primary: "#166534", secondary: "#22c55e", accent: "#15803d", highlight: "#fb923c", pop: "#e879f9"    },

  // Row 4 — creative & playful
  { name: "Neon",        primary: "#22d3ee", secondary: "#a78bfa", accent: "#f472b6", highlight: "#facc15", pop: "#4ade80"    },
  { name: "Candy",       primary: "#ec4899", secondary: "#f472b6", accent: "#db2777", highlight: "#a78bfa", pop: "#34d399"    },
  { name: "Electric",    primary: "#3b82f6", secondary: "#60a5fa", accent: "#2563eb", highlight: "#f97316", pop: "#a3e635"    },
  { name: "Coral",       primary: "#f97171", secondary: "#fca5a5", accent: "#ef4444", highlight: "#fbbf24", pop: "#38bdf8"    },
  { name: "Aurora",      primary: "#a855f7", secondary: "#22d3ee", accent: "#6366f1", highlight: "#34d399", pop: "#fbbf24"    },
  { name: "Tropical",    primary: "#f59e0b", secondary: "#10b981", accent: "#06b6d4", highlight: "#f43f5e", pop: "#a855f7"    },
];

/* ── color swatch input ──────────────────────────────────────────────── */

function ColorSwatch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <label
          className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] transition-all hover:scale-105"
          style={{ background: value, boxShadow: `0 0 12px ${hexToRgba(value, 0.35)}` }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <Palette className="h-3.5 w-3.5" style={{ color: luminance(value) > 0.5 ? "#000" : "#fff" }} />
        </label>
        <div className="flex flex-1 flex-col justify-center">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-xs font-mono focus:border-[var(--red)] outline-none"
          />
          <p className="mt-0.5 text-[8px] font-mono text-[var(--text-dim)] leading-tight">{hint}</p>
        </div>
      </div>
    </div>
  );
}

/* ── main form ───────────────────────────────────────────────────────── */

export default function AgencyBrandingForm({ agencyId, defaults }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaults.name);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(defaults.secondaryColor || defaults.primaryColor);
  const [accentColor, setAccentColor] = useState(defaults.accentColor || defaults.primaryColor);
  const [highlightColor, setHighlightColor] = useState(defaults.highlightColor || "#ff6b35");
  const [popColor, setPopColor] = useState(defaults.popColor || "#ffd700");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sec = secondaryColor || primaryColor;
  const acc = accentColor || primaryColor;
  const hlt = highlightColor || "#ff6b35";
  const pop = popColor || "#ffd700";

  function applyPreset(p: Preset) {
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setAccentColor(p.accent);
    setHighlightColor(p.highlight);
    setPopColor(p.pop);
  }

  function isActivePreset(p: Preset) {
    return (
      p.primary === primaryColor &&
      p.secondary === secondaryColor &&
      p.accent === accentColor &&
      p.highlight === highlightColor &&
      p.pop === popColor
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch(`/api/agency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId,
          name,
          logoUrl: logoUrl || null,
          primaryColor,
          secondaryColor: secondaryColor || null,
          accentColor: accentColor || null,
          highlightColor: highlightColor || null,
          popColor: popColor || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      setInfo("Saved! Dashboard will reflect these colors on next load.");
      router.refresh();
    });
  };

  const allColors = [primaryColor, sec, acc, hlt, pop];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── Name & logo ──────────────────────────────────────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">Identity</div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            Agency name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
            Logo URL
          </label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="/logos/agency.png or https://..."
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
          />
        </div>
      </div>

      {/* ── Preset palettes (4 rows × 6) ─────────────────────────── */}
      <div className="panel space-y-4">
        <div className="panel-label">
          <Sparkles className="h-3.5 w-3.5" style={{ color: primaryColor }} />
          Quick palettes
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-2">
          Click a palette to apply all 5 colors instantly, or customize each one below.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {PRESETS.map((p) => {
            const active = isActivePreset(p);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={`group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all hover:scale-[1.04] ${
                  active
                    ? "border-white bg-white/5 ring-1 ring-white/20"
                    : "border-[var(--border)] hover:border-white/30"
                }`}
              >
                {/* 5 color dots — first row of 3, second row of 2 */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-0.5">
                    {[p.primary, p.secondary, p.accent].map((c, i) => (
                      <div
                        key={i}
                        className="h-5 w-5 rounded-full border border-white/10"
                        style={{ background: c, boxShadow: `0 0 6px ${hexToRgba(c, 0.35)}` }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {[p.highlight, p.pop].map((c, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full border border-white/10"
                        style={{ background: c, boxShadow: `0 0 6px ${hexToRgba(c, 0.35)}` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="font-mono text-[7px] uppercase tracking-wider text-[var(--text-dim)] group-hover:text-[var(--text)]">
                  {p.name}
                </span>
                {active && (
                  <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                    <Check className="h-2.5 w-2.5 text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom color pickers (5 slots) ───────────────────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">Custom colors</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <ColorSwatch
            label="Primary"
            hint="Main brand — buttons, badges, headlines"
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorSwatch
            label="Secondary"
            hint="Charts, links, supporting actions"
            value={sec}
            onChange={setSecondaryColor}
          />
          <ColorSwatch
            label="Accent"
            hint="Borders, hover effects, cards"
            value={acc}
            onChange={setAccentColor}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ColorSwatch
            label="Highlight"
            hint="Attention-grabbers — alerts, rank badges, callouts"
            value={hlt}
            onChange={setHighlightColor}
          />
          <ColorSwatch
            label="Pop"
            hint="Fun extras — sparklines, decorations, chart accents"
            value={pop}
            onChange={setPopColor}
          />
        </div>
      </div>

      {/* ── Live preview — mini dashboard ────────────────────────── */}
      <div className="panel space-y-4">
        <div className="panel-label">Live preview</div>

        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[#030303]">
          {/* header bar */}
          <div className="flex items-center justify-between border-b border-[#151515] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: primaryColor, boxShadow: `0 0 8px ${hexToRgba(primaryColor, 0.6)}` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: primaryColor }}>
                {name || "Agency name"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#555]">Engine: Online</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
          </div>

          {/* dashboard body */}
          <div className="p-4 space-y-3">
            {/* stat cards — uses all 5 colors */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: "Spend", value: "$12,450", color: primaryColor },
                { label: "CPL", value: "$101", color: sec },
                { label: "Leads", value: "123", color: acc },
                { label: "CTR", value: "2.4%", color: hlt },
                { label: "ROAS", value: "3.2x", color: pop },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded border p-2"
                  style={{ borderColor: hexToRgba(s.color, 0.25), background: hexToRgba(s.color, 0.04) }}
                >
                  <div className="font-mono text-[7px] uppercase tracking-widest" style={{ color: s.color }}>
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-sm font-bold tracking-tight text-[var(--text)]">{s.value}</div>
                </div>
              ))}
            </div>

            {/* funnel + findings row */}
            <div className="grid grid-cols-2 gap-2">
              {/* mini funnel */}
              <div className="rounded border border-[#151515] p-3 space-y-1.5">
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#555] mb-2">Funnel</div>
                {[
                  { label: "Impressions", w: "100%", color: primaryColor },
                  { label: "Clicks", w: "38%", color: sec },
                  { label: "Leads", w: "12%", color: acc },
                  { label: "Sales", w: "4%", color: hlt },
                ].map((f, i) => (
                  <div key={i} className="relative overflow-hidden rounded-sm border border-[#111] px-2 py-1">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: f.w, background: hexToRgba(f.color, 0.12) }}
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="font-mono text-[7px] uppercase tracking-wider text-[#777]">{f.label}</span>
                      <span className="font-mono text-[8px] font-bold" style={{ color: f.color }}>
                        {f.w}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* mini findings */}
              <div className="rounded border border-[#151515] p-3 space-y-1.5">
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#555] mb-2">Top findings</div>
                {[
                  { rank: "01", title: "Tracking gap", amount: "$877", color: primaryColor },
                  { rank: "02", title: "Geo waste", amount: "$412", color: sec },
                  { rank: "03", title: "Creative fatigue", amount: "$150", color: hlt },
                  { rank: "04", title: "Audience overlap", amount: "$89", color: pop },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border px-2 py-1"
                    style={{ borderColor: hexToRgba(f.color, 0.2), background: hexToRgba(f.color, 0.03) }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[7px] font-bold" style={{ color: f.color }}>
                        #{f.rank}
                      </span>
                      <span className="text-[9px] text-[var(--text)]">{f.title}</span>
                    </div>
                    <span className="font-mono text-[8px] font-bold" style={{ color: f.color }}>
                      {f.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* bar chart — cycles through all 5 colors */}
            <div className="rounded border border-[#151515] p-3">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#555] mb-2">
                Weekly performance
              </div>
              <div className="flex items-end gap-0.5 h-10">
                {[40, 65, 55, 80, 70, 90, 60, 75, 85, 50, 95, 45, 72, 88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${h}%`,
                      background: allColors[i % 5],
                      opacity: 0.6 + (h / 100) * 0.4,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* bottom row — all 5 pills + button */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Critical", color: primaryColor },
                  { label: "Warning", color: sec },
                  { label: "Info", color: acc },
                  { label: "New", color: hlt },
                  { label: "Bonus", color: pop },
                ].map((p, i) => (
                  <span
                    key={i}
                    className="rounded-sm border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider"
                    style={{ borderColor: p.color, color: p.color }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
              <div
                className="rounded px-2.5 py-1 font-mono text-[7px] uppercase tracking-widest text-white"
                style={{ background: primaryColor }}
              >
                Export
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────────────────── */}
      {error && <div className="text-xs font-mono text-[var(--red)]">{error}</div>}
      {info && <div className="text-xs font-mono text-emerald-400">{info}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded text-white font-mono text-xs uppercase tracking-widest px-4 py-3 hover:opacity-90 disabled:opacity-50 transition-all"
        style={{ background: primaryColor, boxShadow: `0 0 20px ${hexToRgba(primaryColor, 0.3)}` }}
      >
        {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}
