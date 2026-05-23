"use client";

import type { PlacementResult, PlacementScore } from "@/engine/analyses/placementAnalysis";
import { useLang } from "@/context/LangContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  placements: PlacementResult;
  targetCpl?: number;
}

const SCORE_COLOR: Record<PlacementScore, string> = {
  winner: "#4ade80",
  acceptable: "#fbbf24",
  underperforming: "#f97316",
  wasting: "#ff0000",
};

const SCORE_LABEL_PRO: Record<PlacementScore, string> = {
  winner: "WINNER",
  acceptable: "OK",
  underperforming: "WEAK",
  wasting: "WASTING",
};

const SCORE_LABEL_PLAIN: Record<PlacementScore, string> = {
  winner: "GREAT",
  acceptable: "OKAY",
  underperforming: "POOR",
  wasting: "LOSING $",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CplTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--text)",
      }}
    >
      <div style={{ color: "var(--text-dim)", marginBottom: 2 }}>{d.name}</div>
      <div>${d.cpl.toFixed(2)} / lead · {d.results} leads</div>
      <div style={{ color: "var(--text-dim)", fontSize: 9 }}>
        ${d.spend.toLocaleString()} spent · {d.ctr.toFixed(1)}% CTR
      </div>
    </div>
  );
}

export default function PlacementsPanel({ placements, targetCpl }: Props) {
  const { t, plain } = useLang();

  const hasData = placements.placements.length > 0;
  const worst = placements.placements.find((p) => p.score === "wasting");
  const best = placements.placements.find((p) => p.score === "winner");

  const chartData = placements.placements
    .filter((p) => p.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  return (
    <div className="panel h-full">
      <div className="panel-label">
        {t("Placement_Breakdown", "Where ads appeared")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Placement × CPL", "Feed vs Stories vs Reels")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Spend and CPL by ad placement surface. WINNER = below median CPL; WASTING = ≥2× median.",
          "How much you're spending on each placement and how well each converts.",
        )}
      </p>

      {!hasData ? (
        <div className="border border-[var(--border)] p-4 text-xs text-[var(--text-dim)]">
          {t(
            "No placement breakdown data. Export a placement breakdown from Meta Ads Manager.",
            "No placement data found. Import a placement breakdown to see this section.",
          )}
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="mb-5">
              <div
                className="mb-1 text-right font-mono"
                style={{ fontSize: 9, color: "var(--red-dim, #7f1d1d)", letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                SPEND BY PLACEMENT
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--text-dim)", fontSize: 9, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tickFormatter={(v) => "$" + v}
                    tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CplTooltip />} />
                  <Bar dataKey="spend" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={SCORE_COLOR[entry.score]} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: "480px" }}>
              <thead>
                <tr>
                  <th>{t("Placement", "Where")}</th>
                  <th className="text-right">{t("Spend", "Spent")}</th>
                  <th className="text-right">{t("Leads", "Leads")}</th>
                  <th className="text-right">{t("CPL", "Cost/Lead")}</th>
                  <th className="text-right">{t("CTR", "Click Rate")}</th>
                  <th>{t("Score", "Rating")}</th>
                </tr>
              </thead>
              <tbody>
                {placements.placements.map((p) => {
                  const color = SCORE_COLOR[p.score];
                  const label = plain ? SCORE_LABEL_PLAIN[p.score] : SCORE_LABEL_PRO[p.score];
                  return (
                    <tr
                      key={p.name}
                      style={{
                        background:
                          p.score === "winner"
                            ? "rgba(74,222,128,0.06)"
                            : p.score === "wasting"
                              ? "rgba(255,0,0,0.08)"
                              : "transparent",
                      }}
                    >
                      <td className="font-mono text-xs font-bold">{p.name}</td>
                      <td className="text-right font-mono text-xs">
                        ${p.spend.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {p.results > 0 ? p.results : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {p.cpl > 0 ? `$${p.cpl.toFixed(2)}` : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {p.ctr > 0 ? `${p.ctr.toFixed(1)}%` : "—"}
                      </td>
                      <td>
                        <span className="status-pill" style={{ color }}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {placements.totalWaste > 0 && (
            <div className="insight-box mt-4">
              <b>{t("WASTE DETECTED:", "MONEY BEING WASTED:")}</b>{" "}
              ${placements.totalWaste.toLocaleString()}{" "}
              {t(
                "on underperforming placements. " + placements.recommendation,
                "on placements that aren't working. " + placements.recommendation,
              )}
            </div>
          )}

          {placements.totalWaste === 0 && best && (
            <div className="insight-box mt-4">
              <b>{t("TOP PLACEMENT:", "BEST PERFORMING:")}</b>{" "}
              {t(
                `${best.name} at $${best.cpl.toFixed(2)} CPL with ${best.ctr.toFixed(1)}% CTR. ${placements.recommendation}`,
                `${best.name} costs $${best.cpl.toFixed(2)} per lead with a ${best.ctr.toFixed(1)}% click rate. ${placements.recommendation}`,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
