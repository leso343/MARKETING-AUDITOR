"use client";

/**
 * ControlsPanel — sticky right-sidebar with live-tuneable controls.
 *
 * Sliders / dropdowns push their values into the URL via `onChange`.
 * The server component above re-runs the engine with the new benchmarks
 * and React re-renders the affected sections.
 */
import { useState, useEffect } from "react";
import { Settings2, Loader2 } from "lucide-react";

interface Props {
  targetCpl: number;
  targetCtr: number;
  industry: string;
  industryOptions: { key: string; label: string }[];
  onChange: (key: string, value: string | null) => void;
  isPending: boolean;
}

const TIME_WINDOWS = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

export default function ControlsPanel({
  targetCpl,
  targetCtr,
  industry,
  industryOptions,
  onChange,
  isPending,
}: Props) {
  // Local state for smooth slider feedback; commits to URL on release.
  const [localCpl, setLocalCpl] = useState(targetCpl);
  const [localCtr, setLocalCtr] = useState(targetCtr);
  const [timeWindow, setTimeWindow] = useState("all");

  useEffect(() => setLocalCpl(targetCpl), [targetCpl]);
  useEffect(() => setLocalCtr(targetCtr), [targetCtr]);

  return (
    <aside className="hidden w-[280px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--sidebar)] xl:block">
      <div className="sticky top-0 px-6 py-9" style={{ maxHeight: "100vh", overflowY: "auto" }}>
        <div className="mb-6 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--red)]" />
          <div
            className="text-sm font-bold uppercase tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Live Controls
          </div>
          {isPending && (
            <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[var(--red)]" />
          )}
        </div>

        {/* Industry */}
        <div className="mb-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
            Industry Benchmark
          </label>
          <select
            className="dark-select"
            value={industry}
            onChange={(e) => {
              onChange("industry", e.target.value);
              onChange("cpl", null);
              onChange("ctr", null);
            }}
          >
            {industryOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target CPL */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
              Target CPL
            </label>
            <span className="font-mono text-sm font-bold text-[var(--red)]">
              ${localCpl}
            </span>
          </div>
          <input
            type="range"
            className="range-input"
            min={20}
            max={200}
            step={5}
            value={localCpl}
            onChange={(e) => setLocalCpl(Number(e.target.value))}
            onMouseUp={(e) =>
              onChange("cpl", String((e.target as HTMLInputElement).value))
            }
            onTouchEnd={(e) =>
              onChange("cpl", String((e.target as HTMLInputElement).value))
            }
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-dim)]">
            <span>$20</span>
            <span>$200</span>
          </div>
        </div>

        {/* Target CTR */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
              Target CTR
            </label>
            <span className="font-mono text-sm font-bold text-[var(--red)]">
              {localCtr.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            className="range-input"
            min={0.5}
            max={5}
            step={0.1}
            value={localCtr}
            onChange={(e) => setLocalCtr(Number(e.target.value))}
            onMouseUp={(e) =>
              onChange("ctr", String((e.target as HTMLInputElement).value))
            }
            onTouchEnd={(e) =>
              onChange("ctr", String((e.target as HTMLInputElement).value))
            }
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-dim)]">
            <span>0.5%</span>
            <span>5.0%</span>
          </div>
        </div>

        {/* Time window (UI only for now — engine ignores it until per-row dates exist) */}
        <div className="mb-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
            Time Window
          </label>
          <select
            className="dark-select"
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
            Applies once date-stamped CSVs are imported.
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-4 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
          Drag sliders → release to recompute. URL is shareable.
        </div>
      </div>
    </aside>
  );
}
