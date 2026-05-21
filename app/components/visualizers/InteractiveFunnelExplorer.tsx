"use client";

/**
 * InteractiveFunnelExplorer
 *
 * Live what-if explorer for the funnel. Each stage is clickable and shows a
 * "target retention %" slider. The component calculates how many additional
 * leads (and recovered $ at the blended CPL) you'd see if that stage held its
 * traffic at the new target rate, with downstream stages keeping their *current*
 * retention rates.
 *
 * Inputs:
 *   funnel       — engine FunnelLeakageResult (stages with count + retentionPct)
 *   blendedCpl   — current $ per lead, used for recovered-dollars math
 *
 * Honours prefers-reduced-motion (skips transitions). Hit targets are
 * 44px+ on touch. Numbers use Space Grotesk via the existing --font-head
 * variable. Waste = red, savings = green.
 */

import { useMemo, useState, useEffect } from "react";
import { ChevronRight, Target, RotateCcw, TrendingUp } from "lucide-react";
import type { FunnelLeakageResult } from "@/engine/analyses/funnelLeakage";
import { useLang } from "@/context/LangContext";

interface Props {
  funnel: FunnelLeakageResult;
  blendedCpl?: number;
}

const STATUS_COLOR: Record<string, string> = {
  ok: "#4ade80",
  warn: "#fbbf24",
  critical: "#ff0000",
};

const PLAIN_STAGE_NAMES: Record<string, string> = {
  "AD_INTEREST (IMPRESSIONS)": "People Who Saw Your Ads",
  "CLICKS PURCHASED": "People Who Clicked",
  "USER_ARRIVAL (VERIFIED SESSIONS)": "People Who Visited Your Website",
  "LEAD_CONVERSION (TRACKED)": "People Who Became Leads",
};

export default function InteractiveFunnelExplorer({ funnel, blendedCpl = 0 }: Props) {
  const { t, plain } = useLang();
  const [selectedIdx, setSelectedIdx] = useState<number>(() =>
    Math.max(
      0,
      funnel.stages.findIndex((s) => s.status === "critical"),
    ),
  );
  // Slider value = target retention % for the selected stage. Default = current.
  const [targetRetention, setTargetRetention] = useState<number>(
    funnel.stages[Math.max(0, funnel.stages.findIndex((s) => s.status === "critical"))]?.retentionPct ?? 50,
  );
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // When user picks a new stage, reset slider to that stage's actual rate
  useEffect(() => {
    const s = funnel.stages[selectedIdx];
    if (s) setTargetRetention(Math.round(s.retentionPct));
  }, [selectedIdx, funnel.stages]);

  const maxCount = useMemo(
    () => Math.max(...funnel.stages.map((s) => s.count), 1),
    [funnel.stages],
  );

  /**
   * Projected funnel under the what-if:
   *  - For stages before `selectedIdx`: counts unchanged.
   *  - For `selectedIdx`: count = previousCount * (targetRetention/100).
   *  - For stages after: keep each stage's existing retention rate, but
   *    propagate the new upstream count.
   */
  const projection = useMemo(() => {
    if (!funnel.stages.length) return { stages: [] as Array<{ count: number }>, recoveredLeads: 0, recoveredUsd: 0 };
    const out: Array<{ count: number }> = [];
    for (let i = 0; i < funnel.stages.length; i++) {
      const stage = funnel.stages[i];
      if (i < selectedIdx) {
        out.push({ count: stage.count });
        continue;
      }
      if (i === selectedIdx) {
        if (i === 0) {
          out.push({ count: stage.count });
        } else {
          const prev = out[i - 1].count;
          out.push({ count: Math.round(prev * (targetRetention / 100)) });
        }
        continue;
      }
      // Stage after the selected one: keep existing retention rate
      const prev = out[i - 1].count;
      const rate = stage.retentionPct / 100;
      out.push({ count: Math.round(prev * rate) });
    }
    const lastIdx = out.length - 1;
    const projectedLeads = out[lastIdx].count;
    const originalLeads = funnel.stages[lastIdx].count;
    const recoveredLeads = projectedLeads - originalLeads;
    const recoveredUsd = recoveredLeads * (blendedCpl || 0);
    return { stages: out, recoveredLeads, recoveredUsd };
  }, [funnel.stages, selectedIdx, targetRetention, blendedCpl]);

  const selectedStage = funnel.stages[selectedIdx];
  const currentRate = selectedStage?.retentionPct ?? 0;
  const delta = targetRetention - currentRate;
  const improving = projection.recoveredLeads > 0;

  const transitionStyle: React.CSSProperties = reducedMotion
    ? { transition: "none" }
    : { transition: "width 220ms ease-out, background 180ms ease-out" };

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Funnel_What_If_Explorer", "Drop-Off Explorer")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Click a stage to model the fix", "Tap a step to see what fixing it would do")}
      </h2>
      <p className="mb-6 text-xs text-[var(--text-dim)]">
        {t(
          "Each stage is interactive. Drag the slider to model an improved retention rate and see leads recovered downstream.",
          "Tap any step. Move the slider to see how many more leads you'd get if that step worked better.",
        )}
      </p>

      {/* Stage list */}
      <div className="flex flex-col gap-2">
        {funnel.stages.map((stage, idx) => {
          const isSelected = idx === selectedIdx;
          const widthPct = Math.min(100, (stage.count / maxCount) * 100);
          const projectedCount = projection.stages[idx]?.count ?? stage.count;
          const projectedWidthPct = Math.min(100, (projectedCount / maxCount) * 100);
          const stageName = plain
            ? (PLAIN_STAGE_NAMES[stage.name] ?? stage.name)
            : stage.name;
          const projectedDelta = projectedCount - stage.count;
          return (
            <button
              key={stage.name}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              aria-pressed={isSelected}
              aria-label={t(
                `Select stage ${idx + 1}: ${stage.name}`,
                `Select step ${idx + 1}: ${stageName}`,
              )}
              className="relative w-full text-left"
              style={{
                minHeight: 56, // 44px touch target + breathing room
                padding: "10px 12px",
                border: `1px solid ${isSelected ? STATUS_COLOR[stage.status] : "var(--border)"}`,
                background: isSelected ? "rgba(255,255,255,0.02)" : "transparent",
                ...transitionStyle,
              }}
            >
              {/* Bar background (current) */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${widthPct}%`,
                  background:
                    stage.status === "critical"
                      ? "rgba(255,0,0,0.10)"
                      : stage.status === "warn"
                        ? "rgba(251,191,36,0.08)"
                        : "rgba(74,222,128,0.08)",
                  ...transitionStyle,
                  pointerEvents: "none",
                }}
              />
              {/* Projected overlay — only on selected & downstream */}
              {idx >= selectedIdx && projectedDelta !== 0 && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${projectedWidthPct}%`,
                    background: improving
                      ? "rgba(74,222,128,0.18)"
                      : "rgba(255,0,0,0.18)",
                    borderRight: `2px dashed ${improving ? "#4ade80" : "#ff0000"}`,
                    ...transitionStyle,
                    pointerEvents: "none",
                  }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0"
                    style={{
                      color: isSelected ? STATUS_COLOR[stage.status] : "var(--text-dim)",
                      transform: isSelected ? "rotate(90deg)" : "none",
                      ...transitionStyle,
                    }}
                  />
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[10px] uppercase tracking-wider truncate"
                      style={{ color: isSelected ? "#ffffff" : "var(--text-dim)" }}
                    >
                      [{String(idx + 1).padStart(2, "0")}] {stageName}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                      {t(
                        `Retention: ${stage.retentionPct.toFixed(1)}%`,
                        `${stage.retentionPct.toFixed(0)}% moved to the next step`,
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div
                    className="font-bold text-lg leading-tight"
                    style={{ fontFamily: "var(--font-head)" }}
                  >
                    {stage.count.toLocaleString()}
                  </div>
                  {idx >= selectedIdx && projectedDelta !== 0 && (
                    <div
                      className="font-mono text-[10px]"
                      style={{ color: improving ? "#4ade80" : "#ff0000" }}
                    >
                      {projectedDelta > 0 ? "+" : ""}
                      {projectedDelta.toLocaleString()} {t("projected", "if fixed")}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* What-if controls */}
      {selectedStage && (
        <div
          className="mt-5 border border-[var(--border)] p-4"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--text-dim)]" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                  {t("What if", "If this step worked at")}
                </div>
                <div
                  className="text-sm font-bold"
                  style={{ fontFamily: "var(--font-head)" }}
                >
                  {plain
                    ? (PLAIN_STAGE_NAMES[selectedStage.name] ?? selectedStage.name)
                    : selectedStage.name}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTargetRetention(Math.round(currentRate))}
              aria-label={t("Reset to current rate", "Reset to current")}
              className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
              style={{ minHeight: 36 }}
            >
              <RotateCcw className="h-3 w-3" />
              {t("Reset", "Reset")}
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {t("Target retention", "Target rate")}
              </span>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-head)",
                  color: delta === 0 ? "var(--text)" : improving ? "#4ade80" : "#ff0000",
                }}
              >
                {targetRetention}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={targetRetention}
              onChange={(e) => setTargetRetention(Number(e.target.value))}
              aria-label={t("Target retention slider", "Target rate slider")}
              className="w-full"
              style={{
                accentColor: improving ? "#4ade80" : delta < 0 ? "#ff0000" : "var(--red)",
                height: 32, // 44px-ish vertical tap area on mobile via padding below
                cursor: "pointer",
              }}
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
              <span>0%</span>
              <span>
                {t(`Current: ${currentRate.toFixed(1)}%`, `Now: ${currentRate.toFixed(0)}%`)}
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Live readout */}
          <div
            className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-[var(--border)] pt-4"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {t("Recovered leads", "Extra leads you'd get")}
              </div>
              <div
                className="mt-1 text-3xl font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-head)",
                  color: projection.recoveredLeads > 0
                    ? "#4ade80"
                    : projection.recoveredLeads < 0
                      ? "#ff0000"
                      : "var(--text)",
                }}
              >
                {projection.recoveredLeads > 0 ? "+" : ""}
                {projection.recoveredLeads.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {t("Recovered spend value", "Money it's worth")}
              </div>
              <div
                className="mt-1 text-3xl font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-head)",
                  color: projection.recoveredUsd > 0
                    ? "#4ade80"
                    : projection.recoveredUsd < 0
                      ? "#ff0000"
                      : "var(--text)",
                }}
              >
                {projection.recoveredUsd >= 0 ? "$" : "-$"}
                {Math.abs(Math.round(projection.recoveredUsd)).toLocaleString()}
              </div>
            </div>
            <div className="sm:col-span-2 flex items-start gap-2 text-[11px] text-[var(--text-dim)]">
              <TrendingUp
                className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                style={{ color: improving ? "#4ade80" : "var(--text-dim)" }}
              />
              <span>
                {t(
                  `If "${selectedStage.name}" retained ${targetRetention}% (vs current ${currentRate.toFixed(1)}%), you'd recover ${Math.abs(projection.recoveredLeads).toLocaleString()} lead${Math.abs(projection.recoveredLeads) === 1 ? "" : "s"} worth ~$${Math.abs(Math.round(projection.recoveredUsd)).toLocaleString()} at your current blended CPL of $${(blendedCpl || 0).toFixed(2)}.`,
                  `If ${targetRetention}% of people made it past this step (instead of ${currentRate.toFixed(0)}%), you'd get ${Math.abs(projection.recoveredLeads).toLocaleString()} more lead${Math.abs(projection.recoveredLeads) === 1 ? "" : "s"} — about $${Math.abs(Math.round(projection.recoveredUsd)).toLocaleString()} worth at your current cost of $${(blendedCpl || 0).toFixed(0)} per lead.`,
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
