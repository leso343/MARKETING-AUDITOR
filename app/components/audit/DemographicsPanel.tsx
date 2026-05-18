"use client";

import type { DemographicsResult } from "@/engine/analyses/demographics";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";

interface Props {
  demographics: DemographicsResult;
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

export default function DemographicsPanel({ demographics }: Props) {
  const { t, plain } = useLang();
  const { openReport } = useReport();

  const activeBrackets = demographics.brackets.filter((b) => b.spend > 0);
  const best = demographics.brackets.reduce(
    (a, b) => (b.outcome === "SCALABLE" && b.cpl > 0 && (a.cpl === 0 || b.cpl < a.cpl) ? b : a),
    { bracket: "—", cpl: 0 } as (typeof demographics.brackets)[0],
  );

  return (
    <div className="panel h-full">
      <div className="panel-label">
        {t("Demographics_Breakdown", "Who Responds Best")}
      </div>
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Age × CPL Analysis", "Which Age Groups Convert Best")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Spend and CPL by age bracket. SCALABLE = below median CPL; REDUCE = >1.8× median.",
          "How much you're spending on each age group and what each lead costs.",
        )}
      </p>

      {activeBrackets.length === 0 ? (
        <div className="border border-[var(--border)] p-4 text-xs text-[var(--text-dim)]">
          {t(
            "No age breakdown data. Drop a breakdown_age_gender.csv into the client folder.",
            "No age data found. Import an age breakdown export to see this section.",
          )}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Age", "Age Group")}</th>
              <th className="text-right">{t("Spend", "Spent")}</th>
              <th className="text-right">{t("Leads", "Leads")}</th>
              <th className="text-right">{t("CPL", "Cost/Lead")}</th>
              <th>{t("Signal", "Action")}</th>
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
      )}

      {best.cpl > 0 && (
        <div className="insight-box mt-4">
          <b>{t("BEST BRACKET:", "MOST EFFICIENT AGE GROUP:")}</b>{" "}
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
