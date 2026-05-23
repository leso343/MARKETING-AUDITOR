"use client";

import type { DemographicsResult } from "@/engine/analyses/demographics";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  demographics: DemographicsResult;
  targetCpl?: number;
}

const OUTCOME_COLOR: Record<string, string> = {
  SCALABLE: "#4ade80",
  MIXED: "#fbbf24",
  REDUCE: "#ff0000",
  NO_DATA: "#666",
};

const OUTCOME_LABEL_PRO: Record<string, string> = {
  SCALABLE: "SCALE",
  MIXED: "HOLD",
  REDUCE: "REDUCE",
  NO_DATA: "—",
};

const OUTCOME_LABEL_PLAIN: Record<string, string> = {
  SCALABLE: "INVEST MORE",
  MIXED: "KEEP AS-IS",
  REDUCE: "SPEND LESS",
  NO_DATA: "—",
};

const BRACKET_ORDER = ["25-34", "35-44", "45-54", "55-64", "65+"];

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
      <div style={{ color: "var(--text-dim)", marginBottom: 2 }}>Age {d.bracket}</div>
      <div>${d.cpl.toFixed(2)} / lead</div>
    </div>
  );
}

export default function DemographicsPanel({ demographics, targetCpl }: Props) {
  const { t, plain } = useLang();
  const { openReport } = useReport();

  const activeBrackets = demographics.brackets.filter((b) => b.spend > 0);
  const best = demographics.brackets.reduce(
    (a, b) => (b.outcome === "SCALABLE" && b.cpl > 0 && (a.cpl === 0 || b.cpl < a.cpl) ? b : a),
    { bracket: "—", cpl: 0 } as (typeof demographics.brackets)[0],
  );

  const chartData = demographics.brackets
    .filter((b) => b.cpl > 0)
    .sort(
      (a, b) =>
        BRACKET_ORDER.indexOf(a.bracket) - BRACKET_ORDER.indexOf(b.bracket),
    );

  return (
    <div className="panel h-full">
      <div className="panel-label">
        {t("Demographics_Breakdown", "Who responds best")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Age × CPL Analysis", "Which age groups become leads cheapest")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Spend and CPL by age bracket. SCALABLE = below median CPL; REDUCE = >1.8× median.",
          "How much you're spending on each age group and what each lead costs.",
        )}
      </p>

      {chartData.length > 0 && (
        <div className="mb-5">
          <div
            className="mb-1 text-right font-mono"
            style={{ fontSize: 9, color: "var(--red-dim, #7f1d1d)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            CPL CURVE
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cplGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#ff0000" />
                </linearGradient>
                <linearGradient id="cplFill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.15} />
                  <stop offset="50%" stopColor="#fbbf24" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ff0000" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#1a1a1a" />
              <XAxis
                dataKey="bracket"
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => "$" + v}
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CplTooltip />} />
              {targetCpl != null && (
                <ReferenceLine
                  y={targetCpl}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  label={{ value: "Target", position: "insideRight", fill: "#fbbf24", fontSize: 9, fontFamily: "monospace" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="cpl"
                stroke="url(#cplGradient)"
                strokeWidth={2}
                fill="url(#cplFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeBrackets.length === 0 ? (
        <div className="border border-[var(--border)] p-4 text-xs text-[var(--text-dim)]">
          {t(
            "No age breakdown data. Drop a breakdown_age_gender.csv into the client folder.",
            "No age data found. Import an age breakdown export to see this section.",
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="data-table" style={{ minWidth: "380px" }}>
          <thead>
            <tr>
              <th>{t("Age", "Age Group")}</th>
              <th className="text-right">{t("Spend", "Spent")}</th>
              <th className="text-right">{t("Leads", "Leads")}</th>
              <th className="text-right">{t("CPL", "Cost/Lead")}</th>
              <th>{t("Signal", "What to do")}</th>
            </tr>
          </thead>
          <tbody>
            {demographics.brackets.map((b) => {
              const color = OUTCOME_COLOR[b.outcome] ?? "#333";
              const outcomeLabel = plain
                ? OUTCOME_LABEL_PLAIN[b.outcome]
                : OUTCOME_LABEL_PRO[b.outcome];
              return (
                <tr
                  key={b.bracket}
                  style={{
                    background:
                      b.outcome === "SCALABLE"
                        ? "rgba(74,222,128,0.06)"
                        : b.outcome === "REDUCE"
                          ? "rgba(255,0,0,0.08)"
                          : b.outcome === "MIXED"
                            ? "rgba(251,191,36,0.06)"
                            : "transparent",
                    opacity: b.spend === 0 ? 0.3 : 1,
                  }}
                >
                  <td className="font-mono text-xs font-bold">{b.bracket}</td>
                  <td className="text-right font-mono text-xs">
                    {b.spend > 0 ? `$${b.spend.toLocaleString()}` : "—"}
                  </td>
                  <td className="text-right font-mono text-xs">{b.leads > 0 ? b.leads : "—"}</td>
                  <td className="text-right font-mono text-xs">
                    {b.cpl > 0 ? `$${b.cpl.toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <span className="status-pill" style={{ color }}>
                      {outcomeLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {best.cpl > 0 && (
        <div className="insight-box mt-4">
          <b>{t("BEST BRACKET:", "CHEAPEST AGE GROUP TO REACH:")}</b>{" "}
          {t(
            `${best.bracket} — $${best.cpl.toFixed(2)} CPL. Prioritise this segment in ad set targeting.`,
            `Ages ${best.bracket} — costs $${best.cpl.toFixed(2)} per lead. Focus more of your budget here.`,
          )}
        </div>
      )}

      <button
        onClick={() => openReport(2)}
        className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        → {t("View full analysis →", "See detailed breakdown →")}
      </button>
    </div>
  );
}
