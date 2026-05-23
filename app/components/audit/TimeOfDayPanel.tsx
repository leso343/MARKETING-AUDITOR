"use client";

import type { TimeResult, HourScore } from "@/engine/analyses/timeAnalysis";
import { useLang } from "@/context/LangContext";

interface Props {
  timeOfDay: TimeResult;
}

const SCORE_COLOR: Record<HourScore, string> = {
  peak: "#4ade80",
  good: "#3b82f6",
  low: "#6b7280",
  dead: "#ff0000",
};

const SCORE_LABEL_PRO: Record<HourScore, string> = {
  peak: "PEAK",
  good: "GOOD",
  low: "LOW",
  dead: "DEAD",
};

const SCORE_LABEL_PLAIN: Record<HourScore, string> = {
  peak: "BEST",
  good: "FINE",
  low: "WEAK",
  dead: "LOSING $",
};

export default function TimeOfDayPanel({ timeOfDay }: Props) {
  const { t, plain } = useLang();

  const hasData = timeOfDay.hours.length > 0;
  const maxSpend = Math.max(...timeOfDay.hours.map((h) => h.spend), 1);

  return (
    <div className="panel h-full">
      <div className="panel-label">
        {t("Dayparting_Analysis", "Best times to run ads")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Hour × CPL Heatmap", "When your ads perform best")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Cost-per-lead by hour. PEAK = bottom 25% CPL; DEAD = $20+ spend, 0 results.",
          "Which hours of the day convert the cheapest. Dead hours waste money with zero leads.",
        )}
      </p>

      {!hasData ? (
        <div className="border border-[var(--border)] p-4 text-xs text-[var(--text-dim)]">
          {t(
            "No hourly breakdown data. Export a time-of-day breakdown from Meta Ads Manager.",
            "No hourly data found. Import a time-of-day breakdown to see this section.",
          )}
        </div>
      ) : (
        <>
          {/* 24-hour heatmap grid */}
          <div className="mb-5">
            <div
              className="mb-2 text-right font-mono"
              style={{ fontSize: 9, color: "var(--red-dim, #7f1d1d)", letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              24-HOUR SPEND HEATMAP
            </div>
            <div className="grid grid-cols-12 gap-1">
              {timeOfDay.hours.map((h) => {
                const intensity = h.spend / maxSpend;
                const color = SCORE_COLOR[h.score];
                return (
                  <div
                    key={h.hour}
                    className="flex flex-col items-center rounded-sm p-1"
                    style={{
                      background: `${color}${Math.round(intensity * 40 + 8).toString(16).padStart(2, "0")}`,
                      border: `1px solid ${color}${Math.round(intensity * 60 + 15).toString(16).padStart(2, "0")}`,
                    }}
                    title={`${h.label}: $${h.spend.toFixed(0)} spent, ${h.results} leads${h.cpl > 0 ? `, $${h.cpl.toFixed(2)}/lead` : ""}`}
                  >
                    <span className="font-mono text-[8px] text-[var(--text-dim)]">{h.label}</span>
                    <span className="font-mono text-[10px] font-bold" style={{ color }}>
                      {h.cpl > 0 ? `$${h.cpl.toFixed(0)}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {(["peak", "good", "low", "dead"] as HourScore[]).map((score) => (
                <div key={score} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: SCORE_COLOR[score] }}
                  />
                  <span className="font-mono text-[8px] uppercase text-[var(--text-dim)]">
                    {plain ? SCORE_LABEL_PLAIN[score] : SCORE_LABEL_PRO[score]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Data table */}
          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: "400px" }}>
              <thead>
                <tr>
                  <th>{t("Hour", "Time")}</th>
                  <th className="text-right">{t("Spend", "Spent")}</th>
                  <th className="text-right">{t("Leads", "Leads")}</th>
                  <th className="text-right">{t("CPL", "Cost/Lead")}</th>
                  <th>{t("Score", "Rating")}</th>
                </tr>
              </thead>
              <tbody>
                {timeOfDay.hours.map((h) => {
                  const color = SCORE_COLOR[h.score];
                  const label = plain ? SCORE_LABEL_PLAIN[h.score] : SCORE_LABEL_PRO[h.score];
                  return (
                    <tr
                      key={h.hour}
                      style={{
                        background:
                          h.score === "peak"
                            ? "rgba(74,222,128,0.06)"
                            : h.score === "dead"
                              ? "rgba(255,0,0,0.08)"
                              : "transparent",
                      }}
                    >
                      <td className="font-mono text-xs font-bold">{h.label}</td>
                      <td className="text-right font-mono text-xs">
                        ${h.spend.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {h.results > 0 ? h.results : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {h.cpl > 0 ? `$${h.cpl.toFixed(2)}` : "—"}
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

          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded border border-[var(--border)] p-3 text-center">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
                {t("Peak Hours", "Best Hours")}
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-[#4ade80]">
                {timeOfDay.peakHours.length > 0
                  ? timeOfDay.peakHours.map((h) => {
                      if (h === 0) return "12a";
                      if (h < 12) return `${h}a`;
                      if (h === 12) return "12p";
                      return `${h - 12}p`;
                    }).join(", ")
                  : "—"}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] p-3 text-center">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
                {t("Dead Hours", "Wasted Hours")}
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-[#ff0000]">
                {timeOfDay.deadHours.length > 0
                  ? timeOfDay.deadHours.map((h) => {
                      if (h === 0) return "12a";
                      if (h < 12) return `${h}a`;
                      if (h === 12) return "12p";
                      return `${h - 12}p`;
                    }).join(", ")
                  : "None"}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] p-3 text-center">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)]">
                {t("Potential Savings", "Could Save")}
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-[var(--text)]">
                {timeOfDay.potentialSavings > 0
                  ? `$${timeOfDay.potentialSavings.toLocaleString()}`
                  : "$0"}
              </div>
            </div>
          </div>

          {timeOfDay.recommendation && (
            <div className="insight-box mt-4">
              <b>{t("DAYPARTING:", "SCHEDULING:")}</b>{" "}
              {t(timeOfDay.recommendation, timeOfDay.recommendation)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
