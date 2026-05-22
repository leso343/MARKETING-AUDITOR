"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  agencyId: string;
  defaults: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

/** Convert hex to rgba for dim variants. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ColorField({
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
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 bg-transparent border border-[var(--border)] cursor-pointer"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-black border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
        />
      </div>
      <p className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">{hint}</p>
    </div>
  );
}

export default function AgencyBrandingForm({ agencyId, defaults }: Props) {
  const router = useRouter();
  const [name, setName] = useState(defaults.name);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(defaults.secondaryColor);
  const [accentColor, setAccentColor] = useState(defaults.accentColor);
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
        body: JSON.stringify({
          agencyId,
          name,
          logoUrl: logoUrl || null,
          primaryColor,
          secondaryColor: secondaryColor || null,
          accentColor: accentColor || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Save failed (${res.status})`);
        return;
      }
      setInfo("Saved. Dashboard will use these colors on next load.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-5">
      <div className="panel-label">Branding</div>

      <div>
        <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1">
          Agency name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
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
          className="w-full bg-black border border-[var(--border)] px-3 py-2 text-sm font-mono focus:border-[var(--red)] outline-none"
        />
      </div>

      {/* Color palette */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-3">
          Brand colors
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField
            label="Primary"
            hint="Buttons, badges, key highlights"
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorField
            label="Secondary"
            hint="Charts, links, secondary actions"
            value={secondaryColor || primaryColor}
            onChange={setSecondaryColor}
          />
          <ColorField
            label="Accent"
            hint="Backgrounds, hover effects, borders"
            value={accentColor || primaryColor}
            onChange={setAccentColor}
          />
        </div>
      </div>

      {/* Live preview */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-2">
          Preview
        </div>
        <div className="border border-[var(--border)] bg-[#030303] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: primaryColor, boxShadow: `0 0 8px ${hexToRgba(primaryColor, 0.5)}` }}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: primaryColor }}>
              {name || "Agency name"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span
              className="border px-2 py-1 uppercase tracking-wider"
              style={{ borderColor: primaryColor, color: primaryColor, background: hexToRgba(primaryColor, 0.08) }}
            >
              Primary button
            </span>
            <span
              className="border px-2 py-1 uppercase tracking-wider"
              style={{
                borderColor: secondaryColor || primaryColor,
                color: secondaryColor || primaryColor,
                background: hexToRgba(secondaryColor || primaryColor, 0.08),
              }}
            >
              Secondary
            </span>
            <span
              className="border px-2 py-1 uppercase tracking-wider"
              style={{
                borderColor: accentColor || primaryColor,
                color: accentColor || primaryColor,
                background: hexToRgba(accentColor || primaryColor, 0.08),
              }}
            >
              Accent
            </span>
          </div>

          <div className="flex gap-2">
            {[primaryColor, secondaryColor || primaryColor, accentColor || primaryColor].map(
              (c, i) => (
                <div key={i} className="flex-1 h-2 rounded-full" style={{ background: c }} />
              ),
            )}
          </div>

          <div className="flex gap-3">
            <div
              className="flex-1 border p-3"
              style={{ borderColor: hexToRgba(primaryColor, 0.3), background: hexToRgba(primaryColor, 0.04) }}
            >
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: primaryColor }}>
                Rank 01
              </div>
              <div className="text-xs text-white mt-1">Sample finding card</div>
              <div className="text-[11px] font-mono mt-1" style={{ color: primaryColor }}>
                $877
              </div>
            </div>
            <div
              className="flex-1 border p-3"
              style={{
                borderColor: hexToRgba(secondaryColor || primaryColor, 0.3),
                background: hexToRgba(secondaryColor || primaryColor, 0.04),
              }}
            >
              <div
                className="font-mono text-[9px] uppercase tracking-widest"
                style={{ color: secondaryColor || primaryColor }}
              >
                Rank 02
              </div>
              <div className="text-xs text-white mt-1">Another finding</div>
              <div className="text-[11px] font-mono mt-1" style={{ color: secondaryColor || primaryColor }}>
                $150
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-xs font-mono text-[var(--red)]">{error}</div>}
      {info && <div className="text-xs font-mono text-emerald-400">{info}</div>}
      <button
        type="submit"
        disabled={pending}
        className="text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90 disabled:opacity-50"
        style={{ background: primaryColor }}
      >
        {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}
