"use client";

import type { ReportingPeriod } from "@/engine/runAudit";
import { useLang } from "@/context/LangContext";

interface Props {
  blendedCpl: number;
  weightedCtr: number;
  liveCpl: number;
  liveCtr: number;
  industry: string;
  reportingPeriod: ReportingPeriod;
  isPreview?: boolean;
}

function Metric({
  label,
  actual,
  target,
  formatActual,
  formatTarget,
  lowerIsBetter,
}: {
  label: string;
  actual: number;
  target: number;
  formatActual: (v: number) => string;
  formatTarget: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  if (actual <= 0 || target <= 0) return null;

  const passing = lowerIsBetter ? actual <= target : actual >= target;
  const delta = lowerIsBetter
    ? ((actual - target) / target) * 100
    : ((actual - target) / target) * 100;
  const absDelta = Math.abs(delta);
  const accent = passing ? "#4ade80" : absDelta > 50 ? "#ff0000" : "#fbbf24";
  const statusLabel = passing ? "PASS" : "FAIL";
  const arrow = lowerIsBetter
    ? actual < target ? "↓" : "↑"
    : actual > target ? "↑" : "↓";

  // Bar: how far actual is from target, capped at 200%
  const ratio = lowerIsBetter
    ? Math.min(actual / target, 2)
    : Math.min(target / actual, 2);
  const barPct = Math.min((ratio) * 100, 100);

  return (
    <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-black p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">{label}</span>
        <span
          className="border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-colors duration-200"
          style={{ color: accent, borderColor: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)` }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-xl font-extrabold transition-colors duration-200"
          style={{ color: accent }}
        >
          {formatActual(actual)}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">
          vs {formatTarget(target)} target
        </span>
      </div>

      {/* Progress bar showing how actual compares to target */}
      <div className="my-2 h-1 w-full rounded-sm bg-[var(--border)]">
        <div
          className="h-1 rounded-sm transition-all duration-300"
          style={{ width: `${barPct}%`, background: accent, opacity: 0.75 }}
        />
      </div>

      <div className="font-mono text-[10px]" style={{ color: accent }}>
        {passing
          ? `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? "below" : "above"} target — on track`
          : `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? "above" : "below"} target — needs work`}
      </div>
    </div>
  );
}

export default function BenchmarkStatus({
  blendedCpl, weightedCtr, liveCpl, liveCtr, industry, reportingPeriod, isPreview,
}: Props) {
  const { t } = useLang();

  return (
    <div
      className="panel py-4 transition-all duration-200"
      style={isPreview ? { borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.03)" } : {}}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="panel-label" style={{ marginBottom: 0 }}>
            {t("Benchmark_Status", "Performance vs. Target")}
          </div>
          {isPreview && (
            <span className="border border-[#fbbf2440] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#fbbf24]">
              ⚡ What-if preview
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {reportingPeriod.isScaled && (
            <span className="border border-[#fbbf2440] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#fbbf24]">
              ⚡ Est. {reportingPeriod.filterDays}d of {reportingPeriod.totalDays}d export
            </span>
          )}
          <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)] opacity-60">
            Drag sliders to run what-if scenarios
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Metric
          label={t("Blended CPL", "Cost Per Lead")}
          actual={blendedCpl}
          target={liveCpl}
          formatActual={(v) => `$${v.toFixed(2)}`}
          formatTarget={(v) => `$${v.toFixed(0)}`}
          lowerIsBetter={true}
        />
        <Metric
          label={t("Weighted CTR", "Click Rate")}
          actual={weightedCtr}
          target={liveCtr}
          formatActual={(v) => `${v.toFixed(2)}%`}
          formatTarget={(v) => `${v.toFixed(1)}%`}
          lowerIsBetter={false}
        />
        <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-black p-4">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
            {t("Industry", "Industry Benchmarks")}
          </div>
          <div className="font-mono text-sm font-bold capitalize text-white">{industry}</div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-dim)]">
            CPL target: <span className="text-white">${liveCpl}</span>
          </div>
          <div className="font-mono text-[10px] text-[var(--text-dim)]">
            CTR target: <span className="text-white">{liveCtr.toFixed(1)}%</span>
          </div>
          <div className="mt-2 font-mono text-[8px] text-[var(--text-dim)] opacity-60">
            Change industry → auto-sets benchmarks
          </div>
        </div>
      </div>
    </div>
  );
}
