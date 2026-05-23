"use client";

import type { AuditResult } from "@/engine/runAudit";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";

interface Props {
  audit: AuditResult;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

type DotColor = "ok" | "warn" | "critical";

function dot(color: DotColor) {
  const colors: Record<DotColor, string> = {
    ok: "#4ade80",
    warn: "#fbbf24",
    critical: "#ff0000",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: colors[color],
        flexShrink: 0,
      }}
    />
  );
}

interface ChipProps {
  label: string;
  value: string;
  status?: DotColor;
  anchor?: string;
}

function Chip({ label, value, status, anchor }: ChipProps) {
  const handleClick = () => {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <button
      onClick={handleClick}
      className="flex shrink-0 items-center gap-1.5 border border-[var(--border)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors hover:border-[#333]"
      style={{ background: "transparent", cursor: anchor ? "pointer" : "default" }}
    >
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 700 }}>{value}</span>
      {status && dot(status)}
    </button>
  );
}

function Divider() {
  return (
    <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)] opacity-50" aria-hidden>
      |
    </span>
  );
}

export default function AuditRibbon({ audit }: Props) {
  const { t } = useLang();
  const { openReport } = useReport();

  const { spend, tracking, geo, creative, benchmarks, generatedAt } = audit;

  const cplStatus: DotColor =
    spend.blendedCpl === 0
      ? "warn"
      : spend.blendedCpl > benchmarks.targetCpl * 1.5
        ? "critical"
        : spend.blendedCpl > benchmarks.targetCpl
          ? "warn"
          : "ok";

  const ctrStatus: DotColor =
    spend.weightedCtr === 0
      ? "warn"
      : spend.weightedCtr < benchmarks.targetCtr * 0.5
        ? "critical"
        : spend.weightedCtr < benchmarks.targetCtr
          ? "warn"
          : "ok";

  const freqStatus: DotColor =
    spend.averageFrequency > 4
      ? "critical"
      : spend.averageFrequency > 2.5
        ? "warn"
        : "ok";

  const trackStatus: DotColor =
    tracking.overallScore >= 80
      ? "ok"
      : tracking.overallScore >= 50
        ? "warn"
        : "critical";

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto px-4 py-2 sm:px-10"
      style={{
        background: "var(--sidebar)",
        borderBottom: "1px solid var(--border)",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--red) var(--bg)",
        WebkitOverflowScrolling: "touch",
        whiteSpace: "nowrap",
      }}
    >
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
        {formatDate(generatedAt)}
      </span>

      <Divider />

      <Chip
        label={t("SPEND", "SPEND")}
        value={`$${spend.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        anchor="overview"
      />

      <Chip
        label={t("CTR", "CLICK RATE")}
        value={`${spend.weightedCtr.toFixed(2)}%`}
        status={ctrStatus}
        anchor="leakage"
      />

      {/* CPL — only shown when lead-objective campaigns ran (Meta's
          "Results" = lead form submissions). For Traffic-objective accounts
          this is hidden in favour of CPC (next chip). */}
      {spend.blendedCpl > 0 && (
        <Chip
          label={t("CPL", "COST/LEAD")}
          value={`$${spend.blendedCpl.toFixed(2)}`}
          status={cplStatus}
          anchor="leakage"
        />
      )}

      {/* CPC — total spend / link clicks, always shown when clicks exist. */}
      {spend.weightedCpc > 0 && (
        <Chip
          label={t("CPC", "COST/CLICK")}
          value={`$${spend.weightedCpc.toFixed(2)}`}
          anchor="leakage"
        />
      )}

      <Chip
        label={t("LEADS", "LEADS")}
        value={String(spend.totalLeads)}
        status={spend.totalLeads === 0 ? "critical" : "ok"}
        anchor="leakage"
      />

      <Chip
        label={t("FREQ", "TIMES SHOWN")}
        value={spend.averageFrequency.toFixed(2)}
        status={freqStatus}
        anchor="leakage"
      />

      <Chip
        label={t("TRACKING", "TRACKING OK?")}
        value={`${tracking.overallScore}/100`}
        status={trackStatus}
        anchor="tracking"
      />

      <Chip
        label={t("GEO WASTE", "MONEY WASTED")}
        value={`$${Math.round(geo.wasteUSD).toLocaleString()}`}
        status={geo.wasteUSD > 200 ? "critical" : geo.wasteUSD > 50 ? "warn" : "ok"}
        anchor="geo"
      />

      <Chip
        label={t("WINNERS", "TOP ADS")}
        value={String(creative.winners.length)}
        status={creative.winners.length > 0 ? "ok" : "warn"}
        anchor="creative"
      />

      <Chip
        label={t("WASTERS", "WORST ADS")}
        value={String(creative.wasters.length)}
        status={creative.wasters.length === 0 ? "ok" : "critical"}
        anchor="creative"
      />

      <Divider />

      {/* Full report CTA */}
      <button
        onClick={() => openReport(1)}
        className="flex shrink-0 items-center gap-1.5 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.08)] px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:bg-[rgba(255,0,0,0.15)]"
      >
        📊 {t("FULL REPORT →", "FULL REPORT →")}
      </button>
    </div>
  );
}
