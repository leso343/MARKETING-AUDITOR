"use client";

import type { FunnelLeakageResult } from "@/engine/analyses/funnelLeakage";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";

interface Props {
  funnel: FunnelLeakageResult;
}

const STATUS_COLOR: Record<string, string> = {
  ok: "#4ade80",
  warn: "#fbbf24",
  critical: "#ff0000",
};

const PLAIN_STAGE_NAMES: Record<string, string> = {
  "AD_INTEREST (IMPRESSIONS)":      "People Who Saw Your Ads",
  "CLICKS PURCHASED":               "People Who Clicked",
  "USER_ARRIVAL (VERIFIED SESSIONS)": "People Who Visited Your Website",
  "LEAD_CONVERSION (TRACKED)":      "People Who Became Leads",
};

export default function FunnelLeakageChart({ funnel }: Props) {
  const { t, plain } = useLang();
  const { openReport } = useReport();
  const maxCount = Math.max(...funnel.stages.map((s) => s.count), 1);

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Funnel_Integrity_Diagnostic", "Customer Drop-Off Analysis")}
      </div>
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Tracking People vs. Clicks", "Where Customers Drop Off")}
      </h2>
      <p className="mb-6 text-xs text-[var(--text-dim)]">
        {t(
          "Impression → Click → Session → Lead, with retention % per stage.",
          "How many people moved through each step toward becoming a lead.",
        )}
      </p>

      {funnel.stages.map((stage, idx) => {
        const widthPct = Math.min(100, (stage.count / maxCount) * 100);
        const stageName = plain
          ? (PLAIN_STAGE_NAMES[stage.name] ?? stage.name)
          : stage.name;
        return (
          <div key={stage.name} className="funnel-stage">
            <div
              className="funnel-fill"
              style={{
                width: `${widthPct}%`,
                background:
                  stage.status === "critical"
                    ? "rgba(255,0,0,0.15)"
                    : stage.status === "warn"
                      ? "rgba(251,191,36,0.10)"
                      : "rgba(74,222,128,0.10)",
              }}
            />
            <div className="funnel-content">
              <div>
                <div className="stage-label">
                  [{String(idx + 1).padStart(2, "0")}] {stageName}
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                  {stage.note}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="stage-val">{stage.count.toLocaleString()}</div>
                {idx === 0 ? (
                  <div className="font-mono text-[10px] text-[var(--text-dim)]">
                    {t("— baseline", "— starting point")}
                  </div>
                ) : (
                  <div
                    className="font-mono text-[10px]"
                    style={{ color: STATUS_COLOR[stage.status] }}
                  >
                    {stage.retentionPct}%{" "}
                    {t("retained", "kept")}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="insight-box">
        <b>{t("FORENSIC FINDING:", "WHAT WE FOUND:")}</b> {funnel.primaryLeak}
        <br />
        <br />
        <b>{t("LEAKAGE SCORE:", "DROP-OFF SCORE:")}</b>{" "}
        <span style={{ color: funnel.leakageScore > 50 ? "var(--red)" : "#fbbf24" }}>
          {funnel.leakageScore}/100
        </span>
        <span className="ml-2 text-[var(--text-dim)]">
          {t(
            "(higher = worse retention drop at the worst stage)",
            "(0 = no drop-off, 100 = total breakdown)",
          )}
        </span>
      </div>

      <button
        onClick={() => openReport(1)}
        className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        → {t("View full analysis →", "See detailed breakdown →")}
      </button>
    </div>
  );
}
