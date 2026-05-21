"use client";

import { useLang } from "@/context/LangContext";

export type Density = "compact" | "normal" | "comfortable";

interface Props {
  density: Density;
  onChange: (d: Density) => void;
}

/**
 * Small toolbar at the top of the dashboard's main content column.
 * Lets the user scale the dashboard to fit more on screen (Compact),
 * stay at default (Normal), or zoom in for easier reading (Comfortable).
 * Choice persists in localStorage via the parent.
 *
 * Styled to match the chrome aesthetic of ControlsPanel / header buttons:
 * mono labels, var(--red-dim) borders, var(--red) accents.
 */
export default function DensityControl({ density, onChange }: Props) {
  const { t } = useLang();
  const options: { key: Density; pro: string; plain: string }[] = [
    { key: "compact",     pro: "Compact",     plain: "Compact" },
    { key: "normal",      pro: "Normal",      plain: "Normal" },
    { key: "comfortable", pro: "Comfortable", plain: "Comfortable" },
  ];
  return (
    <div className="flex items-center gap-2 px-4 pt-3 sm:px-10 sm:pt-4">
      <span className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
        {t("Density", "Size")}
      </span>
      <div className="flex border border-[var(--border)]">
        {options.map((opt) => {
          const active = opt.key === density;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              aria-pressed={active}
              className="px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors"
              style={{
                borderRight: opt.key !== "comfortable" ? "1px solid var(--border)" : undefined,
                background: active ? "rgba(255,0,0,0.08)" : "transparent",
                color: active ? "var(--red)" : "var(--text-dim)",
              }}
            >
              {t(opt.pro, opt.plain)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
