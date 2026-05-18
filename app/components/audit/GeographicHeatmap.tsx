"use client";

import type { GeographicWasteResult } from "@/engine/analyses/geographicWaste";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";

interface Props {
  geo: GeographicWasteResult;
  liveCpl?: number;
}

const STATUS_BG: Record<string, string> = {
  hot:   "rgba(74,222,128,0.10)",
  mixed: "rgba(251,191,36,0.10)",
  cold:  "rgba(251,191,36,0.15)",
  leak:  "rgba(255,0,0,0.15)",
};
const STATUS_TEXT: Record<string, string> = {
  hot:   "#4ade80",
  mixed: "#fbbf24",
  cold:  "#fbbf24",
  leak:  "#ff0000",
};

const PLAIN_STATUS: Record<string, string> = {
  hot:   "TOP AREA",
  mixed: "OK AREA",
  cold:  "WEAK AREA",
  leak:  "WASTED",
};

export default function GeographicHeatmap({ geo, liveCpl }: Props) {
  const { t, plain } = useLang();
  const { openReport } = useReport();
  const maxSpend = Math.max(...geo.regions.map((r) => r.spend), 1);

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Geographic_Leakage_Audit", "Spending by Location")}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <Mini
          label={t("Zones_Mapped", "Areas")}
          value={String(geo.zonesMapped)}
        />
        <Mini
          label={t("Core_Hot", "Best Area Spend")}
          value={`$${Math.round(geo.coreHotSpend).toLocaleString()}`}
        />
        <Mini
          label={t("Leakage_Out", "Wasted Budget")}
          value={`$${Math.round(geo.wasteUSD).toLocaleString()}`}
          tone="leak"
        />
      </div>

      <table className="data-table w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ padding: "10px 8px" }}>{t("Region", "Location")}</th>
            <th className="text-right" style={{ padding: "10px 8px" }}>{t("Spend", "Spent")}</th>
            <th className="text-right" style={{ padding: "10px 8px" }}>{t("Leads", "Leads")}</th>
            <th className="text-right" style={{ padding: "10px 8px" }}>{t("CPL", "Cost/Lead")}</th>
            <th style={{ padding: "10px 8px" }}>{t("Status", "Result")}</th>
          </tr>
        </thead>
        <tbody>
          {geo.regions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-[var(--text-dim)]">
                {t(
                  "No geographic breakdown found. Drop breakdowns.csv into the client CSV folder.",
                  "No location data found. Import a DMA breakdown export to see this section.",
                )}
              </td>
            </tr>
          )}
          {geo.regions.map((r) => {
            const widthPct = (r.spend / maxSpend) * 100;
            const statusLabel = plain
              ? (PLAIN_STATUS[r.status] ?? r.status.toUpperCase())
              : r.status.toUpperCase();
            return (
              <tr
                key={r.name}
                className="relative"
                style={{ background: STATUS_BG[r.status] }}
              >
                <td
                  className="font-mono font-bold"
                  style={{ fontSize: 11, padding: "10px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={r.name}
                >
                  {r.name}
                </td>
                <td className="text-right font-mono" style={{ fontSize: 11, padding: "10px 8px" }}>
                  ${r.spend.toLocaleString()}
                  <div className="mt-1 h-[2px] w-full bg-[#111]">
                    <div
                      className="h-full bg-[var(--red)]"
                      style={{ width: `${widthPct}%`, opacity: 0.5 }}
                    />
                  </div>
                </td>
                <td className="text-right font-mono" style={{ fontSize: 11, padding: "10px 8px" }}>{r.conversions}</td>
                <td className="text-right font-mono" style={{ fontSize: 11, padding: "10px 8px" }}>
                  {r.cpl > 0 ? `$${r.cpl.toFixed(2)}` : "—"}
                  {liveCpl && r.cpl > 0 && (
                    <div
                      className="mt-0.5 font-mono text-[8px] font-bold"
                      style={{ color: r.cpl <= liveCpl ? "#4ade80" : "#ff0000" }}
                    >
                      {r.cpl <= liveCpl ? `✓ below $${liveCpl} target` : `✗ above $${liveCpl} target`}
                    </div>
                  )}
                </td>
                <td style={{ verticalAlign: "middle", padding: "10px 8px" }}>
                  <span
                    className="status-pill"
                    style={{
                      color: STATUS_TEXT[r.status],
                      display: "inline-block",
                      whiteSpace: "normal",
                      lineHeight: 1.2,
                      wordBreak: "break-word",
                      fontSize: 9,
                    }}
                  >
                    {statusLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="insight-box">
        <b>{t("RECOMMENDATION:", "SUGGESTED ACTION:")}</b> {geo.recommendation}
      </div>

      <button
        onClick={() => openReport(4)}
        className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        → {t("View full analysis →", "See detailed breakdown →")}
      </button>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "leak";
}) {
  return (
    <div className="border border-[var(--border)] bg-[#060606] px-3 py-2.5">
      <div
        className="font-mono text-base font-extrabold leading-none"
        style={{ color: tone === "leak" ? "var(--red)" : "#fff" }}
      >
        {value}
      </div>
      <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[1.5px] text-[#888]">
        {label}
      </div>
    </div>
  );
}
