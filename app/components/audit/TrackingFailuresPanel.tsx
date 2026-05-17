"use client";

import type { TrackingFailuresResult } from "@/engine/analyses/trackingFailures";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";

interface Props {
  tracking: TrackingFailuresResult;
}

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: ShieldAlert,
  warn: AlertTriangle,
  ok: CheckCircle2,
};

export default function TrackingFailuresPanel({ tracking }: Props) {
  const { t, plain } = useLang();
  const { openReport } = useReport();
  const wastedPct =
    tracking.totalLeadCampaigns > 0
      ? Math.round((tracking.brokenLeadCampaigns / tracking.totalLeadCampaigns) * 100)
      : 0;

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Sentinel_Tracking_Audit", "Ad Tracking Health")}
      </div>

      <div className="border border-[#222] bg-black p-6 text-center">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--red)]">
          {t("Anomaly_Detected", "Attention Needed")}
        </div>
        <div className="text-5xl font-extrabold leading-none">
          {tracking.brokenLeadCampaigns}
        </div>
        <div className="mt-2 font-mono text-[11px] text-[var(--text-dim)]">
          {t(
            "Lead campaigns with broken tracking",
            "Campaigns not being tracked properly",
          )}
        </div>
        <div className="waste-meter">
          <div className="waste-fill" style={{ width: `${Math.min(100, wastedPct)}%` }} />
        </div>
        <div className="text-xl font-extrabold text-[var(--red)]">
          ${tracking.totalWastedSpend.toLocaleString()}{" "}
          {t("EXPOSED", "AT RISK")}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Mini
          label={t("Tracking Score", "Health Score")}
          value={`${tracking.overallScore}/100`}
          tone={
            tracking.overallScore >= 80 ? "ok" : tracking.overallScore >= 50 ? "warn" : "critical"
          }
        />
        <Mini
          label={t("Failures Detected", "Issues Found")}
          value={String(tracking.failures.length)}
          tone={tracking.failures.length === 0 ? "ok" : "critical"}
        />
      </div>

      <div className="mt-5 space-y-2">
        {tracking.failures.length === 0 && (
          <div className="border border-[var(--border)] p-3 text-xs text-[var(--text-dim)]">
            {t("No tracking failures detected.", "All tracking is working correctly.")}
          </div>
        )}
        {tracking.failures.map((f) => {
          const Icon = SEVERITY_ICON[f.severity] ?? AlertTriangle;
          const typeLabel = plain
            ? f.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
            : f.type;
          return (
            <div
              key={`${f.type}-${f.severity}`}
              className="border border-[var(--border)] p-3 text-xs"
              style={{
                borderLeft:
                  f.severity === "critical" ? "3px solid var(--red)" : "3px solid #fbbf24",
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: f.severity === "critical" ? "var(--red)" : "#fbbf24" }}
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-white">
                  {typeLabel}
                </span>
                {f.estimatedImpact > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-[var(--red)]">
                    ${f.estimatedImpact.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-[var(--text-dim)]">{f.description}</div>
            </div>
          );
        })}
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

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "critical";
}) {
  const color = tone === "ok" ? "#4ade80" : tone === "warn" ? "#fbbf24" : "#ff0000";
  return (
    <div className="border border-[#111] p-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-[#444]">{label}</div>
      <div className="mt-1 text-sm font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
