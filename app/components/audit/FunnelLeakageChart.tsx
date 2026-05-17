"use client";

import type { FunnelLeakageResult } from "@/engine/analyses/funnelLeakage";

interface Props {
  funnel: FunnelLeakageResult;
}

const STATUS_COLOR: Record<string, string> = {
  ok: "#4ade80",
  warn: "#fbbf24",
  critical: "#ff0000",
};

export default function FunnelLeakageChart({ funnel }: Props) {
  const maxCount = Math.max(...funnel.stages.map((s) => s.count), 1);

  return (
    <div className="panel h-full">
      <div className="panel-label">Funnel_Integrity_Diagnostic</div>
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        Tracking People vs. Clicks
      </h2>
      <p className="mb-6 text-xs text-[var(--text-dim)]">
        Impression → Click → Session → Lead, with retention % per stage.
      </p>

      {funnel.stages.map((stage, idx) => {
        const widthPct = Math.min(100, (stage.count / maxCount) * 100);
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
                  [{String(idx + 1).padStart(2, "0")}] {stage.name}
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                  {stage.note}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="stage-val">{stage.count.toLocaleString()}</div>
                <div
                  className="font-mono text-[10px]"
                  style={{ color: STATUS_COLOR[stage.status] }}
                >
                  {stage.retentionPct}% retained
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="insight-box">
        <b>FORENSIC FINDING:</b> {funnel.primaryLeak}
        <br />
        <br />
        <b>LEAKAGE SCORE:</b>{" "}
        <span style={{ color: funnel.leakageScore > 50 ? "var(--red)" : "#fbbf24" }}>
          {funnel.leakageScore}/100
        </span>
        <span className="ml-2 text-[var(--text-dim)]">
          (higher = worse retention drop at the worst stage)
        </span>
      </div>
    </div>
  );
}
