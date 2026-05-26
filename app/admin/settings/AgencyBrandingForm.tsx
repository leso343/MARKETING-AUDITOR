"use client";

/**
 * AgencyBrandingForm — agency identity + color theming.
 *
 * Redesigned end-to-end:
 *   - Three clearly grouped color sections: Brand · Accents · Surface
 *   - A NEW background-color slot — pairs with BrandTheme.tsx which
 *     derives card / border / sidebar shades + text contrast from it
 *   - Large interactive live preview that recomputes on every keystroke
 *     so users see the change before saving
 *   - 24-tile preset gallery, each preset stores its own background
 *     color too so picking one actually re-themes everything
 *   - Reset-to-default button to back out of changes
 *   - Save button gets a confirmation + auto-refresh so the agency's
 *     new theme is visible without a manual reload
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Palette, Sparkles, RotateCcw, Save, Image as ImageIcon,
  Eye, Type, Square,
} from "lucide-react";

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
    bgColor: string;
    /**
     * Optional surface overrides — when null/empty, the form treats the
     * field as "auto" and falls back to the derived value. Saving "auto"
     * clears the column in DB so BrandTheme re-derives.
     */
    cardColor: string | null;
    borderColor: string | null;
    textColor: string | null;
  };
}

/* ── color helpers ────────────────────────────────────────────────────── */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}
function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function lighten(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  const nr = Math.min(255, Math.round(r + (255 - r) * amt));
  const ng = Math.min(255, Math.round(g + (255 - g) * amt));
  const nb = Math.min(255, Math.round(b + (255 - b) * amt));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}
function darken(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.round(r * (1 - amt)).toString(16).padStart(2, "0")}${Math.round(g * (1 - amt)).toString(16).padStart(2, "0")}${Math.round(b * (1 - amt)).toString(16).padStart(2, "0")}`;
}
function surfaceShade(hex: string, amt: number) {
  return luminance(hex) > 0.5 ? darken(hex, amt) : lighten(hex, amt);
}

/* ── presets (each carries a bg color so the whole feel can flip) ───── */
type Preset = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  pop: string;
  bg: string;
};

const DEFAULT_BG_DARK = "#030303";
const DEFAULT_BG_PAPER = "#f5f3ee";
const DEFAULT_BG_MIDNIGHT = "#0b1224";
const DEFAULT_BG_FOREST = "#0a1410";

const PRESETS: Preset[] = [
  // Dark themes — the default surface
  { name: "Crimson",  primary: "#ff0000", secondary: "#ff4444", accent: "#cc0000", highlight: "#ff6b35", pop: "#ffd700", bg: DEFAULT_BG_DARK },
  { name: "Ocean",    primary: "#0ea5e9", secondary: "#38bdf8", accent: "#0284c7", highlight: "#06d6a0", pop: "#ffd166", bg: DEFAULT_BG_DARK },
  { name: "Emerald",  primary: "#10b981", secondary: "#34d399", accent: "#059669", highlight: "#f472b6", pop: "#fbbf24", bg: DEFAULT_BG_DARK },
  { name: "Violet",   primary: "#8b5cf6", secondary: "#a78bfa", accent: "#7c3aed", highlight: "#f97316", pop: "#22d3ee", bg: DEFAULT_BG_DARK },
  { name: "Sunset",   primary: "#f97316", secondary: "#fb923c", accent: "#ea580c", highlight: "#a78bfa", pop: "#34d399", bg: DEFAULT_BG_DARK },
  { name: "Rose",     primary: "#f43f5e", secondary: "#fb7185", accent: "#e11d48", highlight: "#38bdf8", pop: "#a3e635", bg: DEFAULT_BG_DARK },
  { name: "Amber",    primary: "#f59e0b", secondary: "#fbbf24", accent: "#d97706", highlight: "#ef4444", pop: "#8b5cf6", bg: DEFAULT_BG_DARK },
  { name: "Cyan",     primary: "#06b6d4", secondary: "#22d3ee", accent: "#0891b2", highlight: "#f43f5e", pop: "#fbbf24", bg: DEFAULT_BG_DARK },
  { name: "Fuchsia",  primary: "#d946ef", secondary: "#e879f9", accent: "#c026d3", highlight: "#22d3ee", pop: "#84cc16", bg: DEFAULT_BG_DARK },
  { name: "Lime",     primary: "#84cc16", secondary: "#a3e635", accent: "#65a30d", highlight: "#f472b6", pop: "#818cf8", bg: DEFAULT_BG_DARK },
  { name: "Slate",    primary: "#64748b", secondary: "#94a3b8", accent: "#475569", highlight: "#f97316", pop: "#22d3ee", bg: DEFAULT_BG_DARK },
  { name: "Gold",     primary: "#eab308", secondary: "#facc15", accent: "#ca8a04", highlight: "#ef4444", pop: "#a855f7", bg: DEFAULT_BG_DARK },

  // Atmospheric — surface picks up a brand tint
  { name: "Midnight", primary: "#6366f1", secondary: "#818cf8", accent: "#4f46e5", highlight: "#fb923c", pop: "#4ade80", bg: DEFAULT_BG_MIDNIGHT },
  { name: "Ember",    primary: "#dc2626", secondary: "#ef4444", accent: "#b91c1c", highlight: "#fbbf24", pop: "#34d399", bg: "#180a0a" },
  { name: "Teal",     primary: "#14b8a6", secondary: "#2dd4bf", accent: "#0d9488", highlight: "#e879f9", pop: "#fb923c", bg: "#06140f" },
  { name: "Wine",     primary: "#9f1239", secondary: "#be123c", accent: "#881337", highlight: "#fbbf24", pop: "#38bdf8", bg: "#16040a" },
  { name: "Storm",    primary: "#6b7280", secondary: "#9ca3af", accent: "#4b5563", highlight: "#f43f5e", pop: "#a78bfa", bg: "#0d1015" },
  { name: "Forest",   primary: "#166534", secondary: "#22c55e", accent: "#15803d", highlight: "#fb923c", pop: "#e879f9", bg: DEFAULT_BG_FOREST },

  // Light themes — for agencies that want a paper-style report look
  { name: "Paper",    primary: "#dc2626", secondary: "#0ea5e9", accent: "#1f2937", highlight: "#f59e0b", pop: "#10b981", bg: DEFAULT_BG_PAPER },
  { name: "Cloud",    primary: "#2563eb", secondary: "#0ea5e9", accent: "#1e3a8a", highlight: "#f59e0b", pop: "#ec4899", bg: "#f8fafc" },
  { name: "Linen",    primary: "#16a34a", secondary: "#14b8a6", accent: "#15803d", highlight: "#ea580c", pop: "#7c3aed", bg: "#fafaf2" },
  { name: "Marble",   primary: "#7c3aed", secondary: "#a855f7", accent: "#6d28d9", highlight: "#dc2626", pop: "#0ea5e9", bg: "#f5f5f7" },
  { name: "Cream",    primary: "#b45309", secondary: "#d97706", accent: "#92400e", highlight: "#dc2626", pop: "#0d9488", bg: "#fef9e7" },
  { name: "Snow",     primary: "#0f172a", secondary: "#64748b", accent: "#1e293b", highlight: "#dc2626", pop: "#16a34a", bg: "#ffffff" },
];

/* ── single color swatch (used by all 6 color slots) ─────────────────── */
function ColorSwatch({
  label, hint, value, onChange, icon,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  const isLight = luminance(value) > 0.5;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          {label}
        </label>
      </div>
      <div className="flex items-stretch gap-2">
        <label
          className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] transition-transform hover:scale-105"
          style={{ background: value, boxShadow: `0 0 16px ${rgba(value, 0.4)}` }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <Palette className="h-4 w-4" style={{ color: isLight ? "#0f172a" : "#ffffff" }} />
        </label>
        <div className="flex flex-1 flex-col justify-center">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-sm font-mono uppercase focus:border-[var(--red)] outline-none"
          />
          <p className="mt-1 text-[10px] font-mono text-[var(--text-dim)] leading-snug">{hint}</p>
        </div>
      </div>
    </div>
  );
}

/* ── surface override swatch (Card/Border/Text — null = auto-derive) ─── */
function SurfaceOverrideSwatch({
  label, hint, value, autoValue, onChange,
}: {
  label: string;
  hint: string;
  /** null = "auto" — derived from bgColor at render time */
  value: string | null;
  autoValue: string;
  onChange: (v: string | null) => void;
}) {
  const isAuto = value === null;
  const shown = value ?? autoValue;
  const isLight = luminance(shown) > 0.5;
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          {label}
        </label>
        {isAuto ? (
          <span className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">
            Auto
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="font-mono text-[8px] uppercase tracking-widest text-[var(--red)] hover:underline"
            title="Reset to auto-derived value"
          >
            Reset → Auto
          </button>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        <label
          className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--border)] transition-transform hover:scale-105"
          style={{ background: shown, boxShadow: `0 0 10px ${rgba(shown, 0.3)}` }}
        >
          <input
            type="color"
            value={shown}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <Palette className="h-3 w-3" style={{ color: isLight ? "#0f172a" : "#ffffff" }} />
        </label>
        <input
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs font-mono uppercase focus:border-[var(--red)] outline-none"
        />
      </div>
      <p className="text-[10px] font-mono text-[var(--text-dim)] leading-snug">{hint}</p>
    </div>
  );
}

/* ── main form ────────────────────────────────────────────────────────── */
export default function AgencyBrandingForm({ agencyId, defaults }: Props) {
  const router = useRouter();
  const [name, setName]                   = useState(defaults.name);
  const [logoUrl, setLogoUrl]             = useState(defaults.logoUrl);
  const [primaryColor, setPrimaryColor]   = useState(defaults.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(defaults.secondaryColor || defaults.primaryColor);
  const [accentColor, setAccentColor]     = useState(defaults.accentColor || defaults.primaryColor);
  const [highlightColor, setHighlightColor] = useState(defaults.highlightColor || "#ff6b35");
  const [popColor, setPopColor]           = useState(defaults.popColor || "#ffd700");
  const [bgColor, setBgColor]             = useState(defaults.bgColor || DEFAULT_BG_DARK);
  // Surface overrides — null = "auto" (derive from bgColor).
  const [cardColor, setCardColor]         = useState<string | null>(defaults.cardColor);
  const [borderColor, setBorderColor]     = useState<string | null>(defaults.borderColor);
  const [textColor, setTextColor]         = useState<string | null>(defaults.textColor);
  const [error, setError]                 = useState<string | null>(null);
  const [info, setInfo]                   = useState<string | null>(null);
  const [pending, startTransition]        = useTransition();

  function applyPreset(p: Preset) {
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setAccentColor(p.accent);
    setHighlightColor(p.highlight);
    setPopColor(p.pop);
    setBgColor(p.bg);
    // Presets reset surface overrides — let auto-derive run again.
    setCardColor(null);
    setBorderColor(null);
    setTextColor(null);
  }

  function isActive(p: Preset) {
    return p.primary === primaryColor
        && p.secondary === secondaryColor
        && p.accent === accentColor
        && p.highlight === highlightColor
        && p.pop === popColor
        && p.bg === bgColor;
  }

  function resetToDefaults() {
    setPrimaryColor(defaults.primaryColor || "#ff0000");
    setSecondaryColor(defaults.secondaryColor || defaults.primaryColor || "#ff4444");
    setAccentColor(defaults.accentColor || defaults.primaryColor || "#cc0000");
    setHighlightColor(defaults.highlightColor || "#ff6b35");
    setPopColor(defaults.popColor || "#ffd700");
    setBgColor(defaults.bgColor || DEFAULT_BG_DARK);
    setCardColor(defaults.cardColor);
    setBorderColor(defaults.borderColor);
    setTextColor(defaults.textColor);
    setError(null);
    setInfo(null);
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
          bgColor: bgColor || null,
          // null on these clears the override → BrandTheme re-derives
          cardColor: cardColor || null,
          borderColor: borderColor || null,
          textColor: textColor || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      setInfo("Saved. Your dashboard is updating…");
      router.refresh();
    });
  };

  // Auto-derived surface shades (mirror BrandTheme.tsx derivation).
  // Manual overrides win when set; otherwise the derived value is used.
  const autoCard   = useMemo(() => surfaceShade(bgColor, 0.05), [bgColor]);
  const autoBorder = useMemo(() => surfaceShade(bgColor, 0.10), [bgColor]);
  const isLightBg  = useMemo(() => luminance(bgColor) > 0.5, [bgColor]);
  const autoText   = isLightBg ? "#0f172a" : "#ffffff";

  const surfaceCard   = cardColor ?? autoCard;
  const surfaceBorder = borderColor ?? autoBorder;
  const surfaceText   = textColor ?? autoText;
  const surfaceDim    = isLightBg ? "#475569" : "#a0a0a0";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── Identity ─────────────────────────────────────────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">
          <ImageIcon className="h-3.5 w-3.5 text-[var(--red)]" />
          Identity
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
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
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
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
      </div>

      {/* ── Preset palettes ─────────────────────────────────────── */}
      <div className="panel space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="panel-label mb-0">
            <Sparkles className="h-3.5 w-3.5" style={{ color: primaryColor }} />
            Preset palettes
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            {PRESETS.length} themes · click to apply
          </span>
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-1">
          Each preset sets all 5 brand colors AND the background. Dark presets up top, light themes at the bottom.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {PRESETS.map((p) => {
            const active = isActive(p);
            const isLightPreset = luminance(p.bg) > 0.5;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={`group relative flex flex-col rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] ${
                  active
                    ? "border-white shadow-[0_0_18px_rgba(255,255,255,0.20)]"
                    : "border-transparent hover:border-white/20"
                }`}
                style={{ background: p.bg }}
              >
                {/* Top: surface preview with brand swatches */}
                <div className="flex h-14 items-center justify-center gap-1 px-2"
                  style={{ background: p.bg }}>
                  {[p.primary, p.secondary, p.accent, p.highlight, p.pop].map((c, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full border"
                      style={{
                        background: c,
                        borderColor: rgba("#ffffff", 0.15),
                        boxShadow: `0 0 8px ${rgba(c, 0.35)}`,
                      }}
                    />
                  ))}
                </div>
                {/* Bottom: name label, contrasted to the bg */}
                <div className="flex items-center justify-center py-1.5"
                  style={{
                    background: isLightPreset ? rgba("#000000", 0.06) : rgba("#ffffff", 0.04),
                    borderTop: `1px solid ${isLightPreset ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  <span className="font-mono text-[9px] uppercase tracking-wider"
                    style={{ color: isLightPreset ? "#0f172a" : "#ffffff" }}>
                    {p.name}
                  </span>
                </div>
                {active && (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-lg">
                    <Check className="h-3 w-3 text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Brand colors (primary / secondary / accent) ─────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">
          <Type className="h-3.5 w-3.5 text-[var(--red)]" />
          Brand colors
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-3">
          The three colors that appear most often — buttons, headlines, charts, borders.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <ColorSwatch
            label="Primary"
            hint="Main brand · CTAs, headlines, focused states"
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorSwatch
            label="Secondary"
            hint="Charts, links, supporting actions"
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
          <ColorSwatch
            label="Accent"
            hint="Borders, hover effects, card edges"
            value={accentColor}
            onChange={setAccentColor}
          />
        </div>
      </div>

      {/* ── Accent colors (highlight / pop) ──────────────────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">
          <Sparkles className="h-3.5 w-3.5 text-[var(--red)]" />
          Accent colors
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-3">
          Used sparingly for callouts, badges, and chart accents — they should contrast with the brand colors above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ColorSwatch
            label="Highlight"
            hint="Attention — alerts, rank badges, important callouts"
            value={highlightColor}
            onChange={setHighlightColor}
          />
          <ColorSwatch
            label="Pop"
            hint="Decorative — sparklines, chart accents, fun details"
            value={popColor}
            onChange={setPopColor}
          />
        </div>
      </div>

      {/* ── Surface (background color + manual overrides) ────────── */}
      <div className="panel space-y-5">
        <div className="panel-label">
          <Square className="h-3.5 w-3.5 text-[var(--red)]" />
          Surface
        </div>
        <p className="text-xs text-[var(--text-dim)] -mt-3">
          The page background. Card, border, and text are auto-derived from this for a balanced look —
          but if a combo doesn&apos;t feel right, override any of them below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ColorSwatch
            label="Background"
            hint={isLightBg
              ? "Light surface — picks dark text by default for legibility"
              : "Dark surface — picks white text by default"}
            value={bgColor}
            onChange={setBgColor}
          />
        </div>

        {/* Manual override swatches — Auto badge when null */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SurfaceOverrideSwatch
            label="Card"
            hint="Panel backgrounds. Override if cards blend into the page."
            value={cardColor}
            autoValue={autoCard}
            onChange={setCardColor}
          />
          <SurfaceOverrideSwatch
            label="Border"
            hint="Panel borders. Override for stronger / subtler edges."
            value={borderColor}
            autoValue={autoBorder}
            onChange={setBorderColor}
          />
          <SurfaceOverrideSwatch
            label="Text"
            hint="Body text. Override if the auto pick has low contrast."
            value={textColor}
            autoValue={autoText}
            onChange={setTextColor}
          />
        </div>
      </div>

      {/* ── LIVE PREVIEW — bigger, sandboxed with the actual colors ── */}
      <div className="panel space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="panel-label mb-0">
            <Eye className="h-3.5 w-3.5 text-[var(--red)]" />
            Live preview
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Recomputes as you type · not saved yet
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border" style={{ borderColor: surfaceBorder }}>
          <div style={{ background: bgColor, color: surfaceText }}>
            {/* preview top nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: surfaceBorder }}>
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full" style={{ background: primaryColor, boxShadow: `0 0 10px ${rgba(primaryColor, 0.7)}` }} />
                <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: primaryColor }}>
                  {name || "Your agency"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: surfaceDim }}>
                  Engine · Online
                </span>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* hero h1 with red highlight */}
              <h2 className="text-xl font-bold tracking-tight" style={{ color: surfaceText }}>
                Forensic Audit · <span style={{ color: primaryColor }}>Diagnostic</span>
              </h2>

              {/* stat tiles — 5 colors */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Spend",  value: "$12,450", color: primaryColor },
                  { label: "CPL",    value: "$101",    color: secondaryColor },
                  { label: "Leads",  value: "123",     color: accentColor },
                  { label: "CTR",    value: "2.4%",    color: highlightColor },
                  { label: "ROAS",   value: "3.2x",    color: popColor },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border p-2.5"
                    style={{
                      borderColor: rgba(s.color, 0.30),
                      background: surfaceCard,
                      borderTopWidth: 2,
                      borderTopColor: s.color,
                    }}>
                    <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: s.color }}>
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-sm font-bold tracking-tight" style={{ color: surfaceText }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* funnel + findings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3 space-y-1.5"
                  style={{ background: surfaceCard, borderColor: surfaceBorder }}>
                  <div className="font-mono text-[8px] uppercase tracking-widest mb-2"
                    style={{ color: surfaceDim }}>Funnel</div>
                  {[
                    { label: "Impressions", w: 100, color: primaryColor },
                    { label: "Clicks",      w: 38,  color: secondaryColor },
                    { label: "Leads",       w: 12,  color: accentColor },
                    { label: "Sales",       w: 4,   color: highlightColor },
                  ].map((f) => (
                    <div key={f.label}
                      className="relative overflow-hidden rounded-sm border px-2 py-1"
                      style={{ borderColor: rgba(f.color, 0.2) }}>
                      <div className="absolute inset-y-0 left-0"
                        style={{ width: `${f.w}%`, background: rgba(f.color, 0.15) }} />
                      <div className="relative flex items-center justify-between">
                        <span className="font-mono text-[8px] uppercase tracking-wider"
                          style={{ color: surfaceDim }}>{f.label}</span>
                        <span className="font-mono text-[9px] font-bold" style={{ color: f.color }}>
                          {f.w}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border p-3 space-y-1.5"
                  style={{ background: surfaceCard, borderColor: surfaceBorder }}>
                  <div className="font-mono text-[8px] uppercase tracking-widest mb-2"
                    style={{ color: surfaceDim }}>Top findings</div>
                  {[
                    { rank: 1, title: "Tracking gap",     amount: "$877", color: primaryColor },
                    { rank: 2, title: "Geo waste",        amount: "$412", color: secondaryColor },
                    { rank: 3, title: "Creative fatigue", amount: "$150", color: highlightColor },
                    { rank: 4, title: "Audience overlap", amount: "$89",  color: popColor },
                  ].map((f) => (
                    <div key={f.rank}
                      className="flex items-center justify-between rounded border px-2 py-1.5"
                      style={{ borderColor: rgba(f.color, 0.25), background: rgba(f.color, 0.05) }}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold" style={{ color: f.color }}>
                          0{f.rank}
                        </span>
                        <span className="text-[10px]" style={{ color: surfaceText }}>{f.title}</span>
                      </div>
                      <span className="font-mono text-[9px] font-bold" style={{ color: f.color }}>
                        {f.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* bar chart */}
              <div className="rounded-md border p-3" style={{ background: surfaceCard, borderColor: surfaceBorder }}>
                <div className="font-mono text-[8px] uppercase tracking-widest mb-2"
                  style={{ color: surfaceDim }}>Weekly performance</div>
                <div className="flex items-end gap-0.5 h-11">
                  {[40, 65, 55, 80, 70, 90, 60, 75, 85, 50, 95, 45, 72, 88].map((h, i) => (
                    <div key={i}
                      className="flex-1 rounded-t-sm transition-all"
                      style={{
                        height: `${h}%`,
                        background: [primaryColor, secondaryColor, accentColor, highlightColor, popColor][i % 5],
                        opacity: 0.55 + (h / 100) * 0.45,
                      }} />
                  ))}
                </div>
              </div>

              {/* pills + CTA */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Critical", color: primaryColor },
                    { label: "Warning",  color: secondaryColor },
                    { label: "Info",     color: accentColor },
                    { label: "New",      color: highlightColor },
                    { label: "Bonus",    color: popColor },
                  ].map((p) => (
                    <span key={p.label}
                      className="rounded border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                      style={{ borderColor: p.color, color: p.color, background: rgba(p.color, 0.06) }}>
                      {p.label}
                    </span>
                  ))}
                </div>
                <button type="button"
                  className="rounded px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white shadow"
                  style={{ background: primaryColor, boxShadow: `0 0 14px ${rgba(primaryColor, 0.45)}` }}
                  onClick={(e) => e.preventDefault()}>
                  Run Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save + reset ─────────────────────────────────────────── */}
      {error && (
        <div className="rounded border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2 text-xs font-mono text-[var(--red)]">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-mono text-emerald-400">
          {info}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 flex items-center justify-center gap-2 rounded text-white font-mono text-xs uppercase tracking-widest px-4 py-3 transition-all disabled:opacity-50 hover:opacity-90"
          style={{ background: primaryColor, boxShadow: `0 0 20px ${rgba(primaryColor, 0.35)}` }}
        >
          {pending ? "Saving…" : <><Save className="h-3.5 w-3.5" /> Save branding</>}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={pending}
          className="flex items-center gap-2 rounded border border-[var(--border)] px-4 py-3 font-mono text-xs uppercase tracking-widest text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--red)] transition-colors disabled:opacity-50"
          title="Restore the colors that were last saved"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
    </form>
  );
}
