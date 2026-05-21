"use client";

import type { ReportingPeriod } from "@/engine/runAudit";
import { useLang } from "@/context/LangContext";
import { Lightbulb } from "lucide-react";

interface Props {
  blendedCpl: number;
  weightedCtr: number;
  liveCpl: number;
  liveCtr: number;
  industry: string;
  reportingPeriod: ReportingPeriod;
  isPreview?: boolean;
}

/* ── Contextual insight generator ─────────────────────────────────────────── */

function cplInsight(actual: number, target: number): { summary: string; detail: string; actions: string[] } {
  if (actual <= 0 || target <= 0) return { summary: "", detail: "", actions: [] };

  const gap = actual - target;
  const pctOff = Math.abs(gap / target) * 100;
  const dollarGap = Math.abs(gap).toFixed(2);

  if (actual <= target) {
    const headroom = (target - actual).toFixed(2);
    return {
      summary: `Your $${actual.toFixed(2)} CPL is ${pctOff.toFixed(1)}% below target — you're getting leads for $${headroom} less than your ceiling.`,
      detail: `Cost Per Lead (CPL) is how much you pay in ad spend for every person who fills out a form or calls. Lower is always better. At your $${target} target, your account is healthy — each lead costs well within budget.`,
      actions: [
        `Scale what's working: push more budget to your lowest-CPL campaigns while CPL stays under $${target}.`,
        `Document which creatives and audiences are driving the $${actual.toFixed(2)} CPL so you can replicate the formula.`,
        "Monitor frequency — if it climbs above 2.5×, CPL tends to rise as the audience fatigues.",
      ],
    };
  }

  if (pctOff <= 30) {
    return {
      summary: `CPL is $${dollarGap} over target — a moderate gap that's closable within 2–4 weeks of focused fixes.`,
      detail: `Cost Per Lead (CPL) measures how much ad spend it takes to generate one lead. You're paying $${actual.toFixed(2)} per lead but your target is $${target}. Closing a ${pctOff.toFixed(0)}% gap is achievable by cutting wasted spend and improving creative quality.`,
      actions: [
        `Pause any ads that have spent over $100 with zero leads — dead weight is the fastest CPL fix.`,
        `Reduce geographic spend in areas where CPL exceeds $${(target * 1.5).toFixed(0)} — those dollars work harder elsewhere.`,
        "Refresh the highest-frequency ad sets with new creative to stop diminishing returns.",
      ],
    };
  }

  return {
    summary: `CPL is ${pctOff.toFixed(0)}% above target — a significant gap requiring structural fixes, not just bid adjustments.`,
    detail: `Cost Per Lead (CPL) is how much you spend per inquiry generated. You're paying $${actual.toFixed(2)} per lead against a $${target} target — a $${dollarGap} gap. This level of overrun typically means tracking issues, geographic waste, or dead-weight creative are silently inflating costs.`,
    actions: [
      "Check pixel firing first — if Meta can't see conversions, it optimises for the wrong thing and CPL spikes.",
      `Cut all campaigns spending more than $${(target * 0.5).toFixed(0)} with zero leads — these are guaranteed losses.`,
      "Consolidate ad sets into fewer, better-funded ones so Meta's algorithm gets enough data to optimise properly.",
      `Narrow geographic targeting to your top-converting service areas — out-of-area spend directly raises your blended CPL.`,
    ],
  };
}

function ctrInsight(actual: number, target: number): { summary: string; detail: string; actions: string[] } {
  if (actual <= 0 || target <= 0) return { summary: "", detail: "", actions: [] };

  const pctOff = Math.abs((actual - target) / target) * 100;

  if (actual >= target) {
    return {
      summary: `${actual.toFixed(2)}% CTR beats the ${target.toFixed(1)}% target — ad creative is generating strong click interest.`,
      detail: `Click-Through Rate (CTR) is the percentage of people who see your ad and click it. Higher is better — it means your creative and message are resonating. At ${actual.toFixed(2)}%, you're above the ${target.toFixed(1)}% benchmark, which signals good creative-audience fit.`,
      actions: [
        "CTR is healthy — focus optimisation energy on CPL instead of click volume.",
        "Identify which specific ad or campaign is driving the high CTR and protect its budget.",
        "Don't chase CTR at the expense of lead quality — a 5% CTR that converts poorly is worse than a 2% CTR that converts well.",
      ],
    };
  }

  return {
    summary: `${actual.toFixed(2)}% CTR is ${pctOff.toFixed(0)}% below the ${target.toFixed(1)}% target — ads aren't compelling enough viewers to click.`,
    detail: `Click-Through Rate (CTR) measures what percentage of people who see your ad click it. A ${actual.toFixed(2)}% CTR means roughly ${Math.round(actual * 10)} in every 1,000 people who see your ad click through. Below ${target.toFixed(1)}% suggests the creative, headline, or offer isn't connecting with your audience.`,
    actions: [
      "Test a stronger hook — lead with the pain point (storm damage, roof leak) rather than your company name.",
      "Try video or Reels format: they typically outperform static images on CTR by 20–40%.",
      "Tighten the audience: a smaller, more relevant audience often yields higher CTR even with lower reach.",
      "A/B test your headline — even a single word change can swing CTR by 30%.",
    ],
  };
}

/* ── Metric card ───────────────────────────────────────────────────────────── */

function Metric({
  label, actual, target, formatActual, formatTarget, lowerIsBetter,
}: {
  label: string; actual: number; target: number;
  formatActual: (v: number) => string; formatTarget: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  if (actual <= 0 || target <= 0) return null;

  const passing = lowerIsBetter ? actual <= target : actual >= target;
  const absDelta = Math.abs(((actual - target) / target) * 100);
  const accent = passing ? "#4ade80" : absDelta > 50 ? "#ff0000" : "#fbbf24";
  const arrow = lowerIsBetter ? (actual < target ? "↓" : "↑") : (actual > target ? "↑" : "↓");
  const barPct = Math.min(lowerIsBetter ? (actual / target) * 100 : (target / actual) * 100, 100);

  return (
    <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-black p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">{label}</span>
        <span
          className="border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-colors duration-200"
          style={{ color: accent, borderColor: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)` }}
        >
          {passing ? "PASS" : "FAIL"}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-extrabold transition-colors duration-200" style={{ color: accent }}>
          {formatActual(actual)}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">vs {formatTarget(target)} target</span>
      </div>
      <div className="my-2 h-1 w-full rounded-sm bg-[var(--border)]">
        <div className="h-1 rounded-sm transition-all duration-300" style={{ width: `${barPct}%`, background: accent, opacity: 0.75 }} />
      </div>
      <div className="font-mono text-[10px]" style={{ color: accent }}>
        {passing
          ? `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? "below" : "above"} target — on track`
          : `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? "above" : "below"} target — needs work`}
      </div>
    </div>
  );
}

/* ── What-if insight card ──────────────────────────────────────────────────── */

function InsightCard({
  title, summary, detail, actions, accent,
}: {
  title: string; summary: string; detail: string; actions: string[]; accent: string;
}) {
  if (!summary) return null;
  return (
    <div className="border border-[var(--border)] bg-black p-4" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>{title}</span>
      </div>
      <p className="mb-2 text-[11px] font-semibold text-white leading-relaxed">{summary}</p>
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-dim)]">{detail}</p>
      <div className="space-y-1.5">
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2 text-[11px]">
            <span className="shrink-0 font-mono text-[10px]" style={{ color: accent }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[var(--text-dim)] leading-relaxed">{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export default function BenchmarkStatus({
  blendedCpl, weightedCtr, liveCpl, liveCtr, industry, reportingPeriod, isPreview,
}: Props) {
  const { t } = useLang();

  const cplData = cplInsight(blendedCpl, liveCpl);
  const ctrData = ctrInsight(weightedCtr, liveCtr);

  const cplPassing = blendedCpl > 0 && liveCpl > 0 && blendedCpl <= liveCpl;
  const ctrPassing = weightedCtr > 0 && liveCtr > 0 && weightedCtr >= liveCtr;

  const cplAccent = cplPassing ? "#4ade80" : Math.abs((blendedCpl - liveCpl) / liveCpl) > 0.5 ? "#ff0000" : "#fbbf24";
  const ctrAccent = ctrPassing ? "#4ade80" : "#fbbf24";

  return (
    <div
      className="panel py-4 transition-all duration-200"
      style={isPreview ? { borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.03)" } : {}}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="panel-label" style={{ marginBottom: 0 }}>
            {t("Benchmark_Status", "How you compare to the goal")}
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
          {!isPreview && (
            <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)] opacity-60">
              Drag sliders to explore what-if scenarios
            </span>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="flex flex-wrap gap-3">
        <Metric
          label={t("Blended CPL", "What each lead costs you")}
          actual={blendedCpl}
          target={liveCpl}
          formatActual={(v) => `$${v.toFixed(2)}`}
          formatTarget={(v) => `$${v.toFixed(0)}`}
          lowerIsBetter={true}
        />
        <Metric
          label={t("Weighted CTR", "How often people click")}
          actual={weightedCtr}
          target={liveCtr}
          formatActual={(v) => `${v.toFixed(2)}%`}
          formatTarget={(v) => `${v.toFixed(1)}%`}
          lowerIsBetter={false}
        />
        <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-black p-4">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
            {t("Industry", "Industry averages")}
          </div>
          <div className="font-mono text-sm font-bold capitalize text-white">{industry}</div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-dim)]">
            CPL target: <span className="text-white">${liveCpl}</span>
          </div>
          <div className="font-mono text-[10px] text-[var(--text-dim)]">
            CTR target: <span className="text-white">{liveCtr.toFixed(1)}%</span>
          </div>
          <div className="mt-2 font-mono text-[8px] text-[var(--text-dim)] opacity-60">
            {isPreview ? "What-if mode — reset slider to restore original" : "Change industry → auto-sets benchmarks"}
          </div>
        </div>
      </div>

      {/* What-if insight panels — appear when slider is moved */}
      {isPreview && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <InsightCard
            title={t("CPL Insight", "What this cost means for you")}
            summary={cplData.summary}
            detail={cplData.detail}
            actions={cplData.actions}
            accent={cplAccent}
          />
          <InsightCard
            title={t("CTR Insight", "What this click rate means")}
            summary={ctrData.summary}
            detail={ctrData.detail}
            actions={ctrData.actions}
            accent={ctrAccent}
          />
        </div>
      )}
    </div>
  );
}
