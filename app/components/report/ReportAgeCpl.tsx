"use client";

/**
 * ReportAgeCpl — bar chart of cost-per-lead by age bracket.
 *
 * Fixes the three bugs the chart audit flagged on DemographicsPanel:
 *   1. Uses BARS for the categorical age brackets (not an area chart
 *      that implied continuous interpolation between buckets).
 *   2. Includes the 18-24 bracket when there's spend in it (the
 *      dashboard chart silently dropped it).
 *   3. Color encodes the CPL VALUE vs the benchmark — green when at
 *      or below target, red when above — not the X-axis position.
 *
 * Benchmark line is drawn at `targetCpl` so the over/under is
 * immediately readable.
 */

import type { DemographicsResult, AgeBracketStat } from "@/engine/analyses/demographics";

interface Props {
  demographics: DemographicsResult;
  targetCpl: number;
}

const BAR_W = 56;
const BAR_GAP = 20;
const LEFT_PAD = 64;
const TOP_PAD = 18;
const CHART_H = 200;

function colorForCpl(cpl: number, target: number): { fill: string; stroke: string; label: string } {
  if (cpl <= 0)                  return { fill: "rgba(120,120,120,0.20)", stroke: "#6B7280", label: "no data" };
  if (cpl <= target * 0.85)      return { fill: "rgba(16,185,129,0.20)",  stroke: "#10B981", label: "under target" };
  if (cpl <= target * 1.15)      return { fill: "rgba(245,158,11,0.20)",  stroke: "#F59E0B", label: "near target" };
  return                                { fill: "rgba(239,68,68,0.22)",   stroke: "#EF4444", label: "over target" };
}

export default function ReportAgeCpl({ demographics, targetCpl }: Props) {
  // Filter to brackets with actual spend so we don't draw empty bars.
  const brackets: AgeBracketStat[] = demographics.brackets.filter((b) => b.spend > 0 || b.cpl > 0);
  if (brackets.length === 0) {
    return (
      <div className="report-chart-card">
        <div className="report-chart-card__title">Cost Per Lead by Age Bracket</div>
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          No demographic data in the current exports.
        </div>
      </div>
    );
  }

  const maxCpl = Math.max(...brackets.map((b) => b.cpl), targetCpl * 1.2, 1);
  const chartW = LEFT_PAD + brackets.length * (BAR_W + BAR_GAP) + BAR_GAP;
  const baselineY = TOP_PAD + CHART_H;
  const targetY = TOP_PAD + CHART_H * (1 - targetCpl / maxCpl);

  return (
    <div className="report-chart-card">
      <div className="report-chart-card__title">Cost Per Lead by Age Bracket</div>

      <svg
        viewBox={`0 0 ${chartW} ${baselineY + 38}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Y-axis frame + ticks (5 lines at 25% steps) */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = TOP_PAD + CHART_H * (1 - frac);
          const label = `$${Math.round(maxCpl * frac)}`;
          return (
            <g key={frac}>
              <line x1={LEFT_PAD} y1={y} x2={chartW - 6} y2={y}
                stroke="var(--border)" strokeWidth="1" opacity={frac === 0 ? 1 : 0.5} />
              <text x={LEFT_PAD - 8} y={y + 3} fontFamily="ui-monospace, monospace" fontSize="9"
                fill="var(--text-dim)" textAnchor="end" fontWeight="600">
                {label}
              </text>
            </g>
          );
        })}

        {/* Target benchmark line */}
        {targetCpl > 0 && targetCpl < maxCpl && (
          <g>
            <line x1={LEFT_PAD} y1={targetY} x2={chartW - 6} y2={targetY}
              stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="5 3" />
            <text x={chartW - 6} y={targetY - 4} fontFamily="ui-monospace, monospace" fontSize="9"
              fill="#F59E0B" textAnchor="end" fontWeight="800" letterSpacing="0.8">
              ${targetCpl} TARGET
            </text>
          </g>
        )}

        {/* Bars */}
        {brackets.map((b, i) => {
          const x = LEFT_PAD + BAR_GAP + i * (BAR_W + BAR_GAP);
          const h = b.cpl > 0 ? CHART_H * (b.cpl / maxCpl) : 4;
          const y = baselineY - h;
          const colors = colorForCpl(b.cpl, targetCpl);
          return (
            <g key={b.bracket}>
              <rect x={x} y={y} width={BAR_W} height={h} rx="2"
                fill={colors.fill} stroke={colors.stroke} strokeWidth="1.5" />
              {b.cpl > 0 && (
                <text x={x + BAR_W / 2} y={y - 6} fontFamily="var(--font-head)" fontSize="11"
                  fill="var(--text)" textAnchor="middle" fontWeight="900">
                  ${b.cpl.toFixed(0)}
                </text>
              )}
              <text x={x + BAR_W / 2} y={baselineY + 14} fontFamily="ui-monospace, monospace" fontSize="9"
                fill="var(--text-dim)" textAnchor="middle" fontWeight="700">
                {b.bracket}
              </text>
              <text x={x + BAR_W / 2} y={baselineY + 26} fontFamily="ui-monospace, monospace" fontSize="8"
                fill={colors.stroke} textAnchor="middle" fontWeight="800" letterSpacing="0.4">
                {b.leads > 0 ? `${b.leads} lead${b.leads !== 1 ? "s" : ""}` : "—"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="report-chart-card__caption">
        Bars colored <strong style={{ color: "#10B981" }}>green</strong> are at or below target,{" "}
        <strong style={{ color: "#F59E0B" }}>amber</strong> near target,{" "}
        <strong style={{ color: "#EF4444" }}>red</strong> over target. Color reflects performance —
        not position on the X-axis.
      </div>
    </div>
  );
}
