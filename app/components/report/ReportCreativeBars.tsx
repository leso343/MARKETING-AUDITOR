"use client";

/**
 * ReportCreativeBars — narrative comparison of creative winners vs
 * wasters with horizontal bars proportional to spend, plus per-ad lead
 * count and CPL pill. Pure SVG so it prints cleanly.
 *
 * Renders BOTH `winners` (lead-CPL top performers) and `wasters` (spend
 * with no/few leads) — the chart audit flagged that the dashboard
 * version never showed `clickWinners`, so we also render the Traffic-
 * objective click winners below the main grid when they exist.
 */

import type { CreativeAnalysisResult, AdScore } from "@/engine/analyses/creativeAnalysis";

interface Props {
  creative: CreativeAnalysisResult;
  /** Max rows per column. Default 5. */
  max?: number;
}

const ROW_H = 38;
const NAME_W = 230;
const BAR_W = 200;

function Section({
  title,
  ads,
  variant,
  maxSpend,
}: {
  title: string;
  ads: AdScore[];
  variant: "winners" | "wasters" | "clicks";
  maxSpend: number;
}) {
  if (ads.length === 0) return null;
  const color = variant === "winners" ? "#10B981" : variant === "wasters" ? "#EF4444" : "#60A5FA";
  const bgColor = variant === "winners" ? "rgba(16,185,129,0.10)"
                : variant === "wasters" ? "rgba(239,68,68,0.10)"
                : "rgba(96,165,250,0.10)";
  return (
    <div>
      <div className="report-chart-card__title" style={{ marginBottom: 8 }}>
        <span style={{ background: color, width: 3, height: 11, display: "inline-block" }} />
        {title}
      </div>
      <svg
        viewBox={`0 0 ${NAME_W + BAR_W + 90} ${ads.length * ROW_H + 6}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {ads.map((ad, i) => {
          const y = i * ROW_H + 8;
          const barLen = maxSpend > 0 ? (ad.spend / maxSpend) * BAR_W : 0;
          return (
            <g key={`${variant}-${ad.adName}-${i}`}>
              {/* Ad name + campaign (left) */}
              <text x="0" y={y + 4} fontFamily="var(--font-head)" fontSize="11"
                fill="var(--text)" fontWeight="700">
                {ad.adName.slice(0, 28)}
              </text>
              <text x="0" y={y + 16} fontFamily="ui-monospace, monospace" fontSize="8"
                fill="var(--text-dim)" fontWeight="600" letterSpacing="0.4">
                {ad.campaignName.slice(0, 36)}
              </text>

              {/* Spend bar — proportional */}
              <rect x={NAME_W} y={y - 4} width={BAR_W} height={18} rx="2"
                fill="rgba(255,255,255,0.04)" stroke="var(--border)" strokeWidth="0.6" />
              <rect x={NAME_W} y={y - 4} width={barLen} height={18} rx="2"
                fill={bgColor} stroke={color} strokeWidth="1" />
              <text x={NAME_W + 6} y={y + 9} fontFamily="var(--font-head)" fontSize="10"
                fill="var(--text)" fontWeight="800">
                ${ad.spend.toFixed(0)}
              </text>
              <text x={NAME_W + BAR_W - 6} y={y + 9} fontFamily="ui-monospace, monospace" fontSize="9"
                fill="var(--text-dim)" textAnchor="end" fontWeight="700">
                {variant === "clicks"
                  ? `${(ad.results ?? 0).toLocaleString()} clk`
                  : `${ad.leadResults} lead${ad.leadResults !== 1 ? "s" : ""}`}
              </text>

              {/* CPL/CPC pill on the right */}
              <g transform={`translate(${NAME_W + BAR_W + 12}, ${y - 4})`}>
                <rect x="0" y="0" width="64" height="18" rx="3" fill={color} />
                <text x="32" y="13" fontFamily="var(--font-head)" fontSize="11"
                  fill="#fff" fontWeight="900" textAnchor="middle">
                  {variant === "clicks"
                    ? `$${ad.cpc.toFixed(2)} CPC`
                    : ad.leadResults > 0
                      ? `$${ad.cpl.toFixed(0)} CPL`
                      : "—"}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ReportCreativeBars({ creative, max = 5 }: Props) {
  const winners = creative.winners.slice(0, max);
  const wasters = creative.wasters.slice(0, max);
  const clickWinners = creative.clickWinners.slice(0, max);

  // Scale all bar lengths against the largest spend across both lists so
  // a $300 winner doesn't look bigger than a $700 waster.
  const allSpend = [...winners, ...wasters, ...clickWinners].map((a) => a.spend);
  const maxSpend = Math.max(1, ...allSpend);

  return (
    <div className="report-chart-card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 22 }}>
        <Section
          title={`Lead-CPL Winners — ${winners.length} top performer${winners.length !== 1 ? "s" : ""}`}
          ads={winners}
          variant="winners"
          maxSpend={maxSpend}
        />
        <Section
          title={`Wasters — ${wasters.length} drained ${wasters.length !== 1 ? "ads" : "ad"}`}
          ads={wasters}
          variant="wasters"
          maxSpend={maxSpend}
        />
        {clickWinners.length > 0 && (
          <Section
            title="Traffic-Objective Top Performers (ranked by CPC, not CPL)"
            ads={clickWinners}
            variant="clicks"
            maxSpend={maxSpend}
          />
        )}
      </div>

      <div className="report-chart-card__caption">
        Bar length = total spend on each ad. CPL pill on the right shows cost per
        lead. <strong>Traffic-objective ads are kept in their own section</strong> so a
        cheap click cost can&apos;t fake a $0.40-per-lead winner against actual lead-gen ads.
      </div>
    </div>
  );
}
