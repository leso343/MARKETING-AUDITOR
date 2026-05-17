"use client";

import type { CreativeAnalysisResult, AdScore } from "@/engine/analyses/creativeAnalysis";
import { Image as ImageIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useLang } from "@/context/LangContext";

interface Props {
  creative: CreativeAnalysisResult;
}

export default function CreativeAnalysisGrid({ creative }: Props) {
  const { t } = useLang();

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Creative_Performance_Drill", "Best vs. Worst Ads")}
      </div>
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Winners vs. Wasters", "Best Ads vs. Worst Ads")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Top quartile by CPL = scale. Dead-weight ($100+ spend, 0 leads) = pause.",
          "Your best-performing ads vs. ones spending money with no results.",
        )}
      </p>

      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#4ade80]">
        <TrendingUp className="h-3.5 w-3.5" />
        {t("Winners", "Best Performing")} ({creative.winners.length})
      </div>
      <div className="space-y-2">
        {creative.winners.length === 0 && (
          <Empty msg={t("No conversion-positive ads yet.", "No successful ads found yet.")} />
        )}
        {creative.winners.slice(0, 3).map((w, i) => (
          <AdCard key={`winner-${w.adName}-${i}`} ad={w} tone="ok" />
        ))}
      </div>

      <div className="mt-5 mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--red)]">
        <TrendingDown className="h-3.5 w-3.5" />
        {t("Wasters", "Wasting Budget")} ({creative.wasters.length})
      </div>
      <div className="space-y-2">
        {creative.wasters.length === 0 && (
          <Empty msg={t("No dead-weight ads detected.", "No wasteful ads found — looking good!")} />
        )}
        {creative.wasters.slice(0, 3).map((w, i) => (
          <AdCard key={`waster-${w.adName}-${i}`} ad={w} tone="critical" />
        ))}
      </div>
    </div>
  );
}

function AdCard({ ad, tone }: { ad: AdScore; tone: "ok" | "critical" }) {
  const { t } = useLang();
  const border = tone === "ok" ? "#4ade80" : "var(--red)";
  return (
    <div
      className="flex items-start gap-3 border border-[var(--border)] bg-black p-3"
      style={{ borderLeft: `3px solid ${border}` }}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--card)]">
        <ImageIcon className="h-4 w-4 text-[var(--text-dim)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-white" title={ad.headline || ad.adName}>
          {ad.headline || ad.adName || t("(no name)", "(unnamed ad)")}
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--text-dim)]">
          {ad.body || ad.campaignName}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
          <Metric label={t("Spend", "Spent")} value={`$${ad.spend.toLocaleString()}`} />
          <Metric
            label={t("CPL", "Cost/Lead")}
            value={ad.cpl > 0 ? `$${ad.cpl.toFixed(2)}` : "—"}
          />
          <Metric label={t("CTR", "Click Rate")} value={`${ad.ctr.toFixed(2)}%`} />
        </div>
        <div className="mt-2 text-[10px] italic" style={{ color: border }}>
          {ad.reason}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-wider text-[#444]">{label}</div>
      <div className="font-bold text-white">{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="border border-[var(--border)] p-3 text-[11px] text-[var(--text-dim)]">
      {msg}
    </div>
  );
}
