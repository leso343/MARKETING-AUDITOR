"use client";

import type { CreativeAnalysisResult } from "@/engine/analyses/creativeAnalysis";
import type { AdScore } from "@/engine/analyses/creativeAnalysis";
import { Image as ImageIcon, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  creative: CreativeAnalysisResult;
}

export default function CreativeAnalysisGrid({ creative }: Props) {
  return (
    <div className="panel h-full">
      <div className="panel-label">Creative_Performance_Drill</div>
      <h2
        className="mb-1 text-xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        Winners vs. Wasters
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        Top quartile by CPL = scale. Dead-weight ($100+ spend, 0 leads) = pause.
      </p>

      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#4ade80]">
        <TrendingUp className="h-3.5 w-3.5" /> Winners ({creative.winners.length})
      </div>
      <div className="space-y-2">
        {creative.winners.length === 0 && (
          <Empty msg="No conversion-positive ads yet." />
        )}
        {creative.winners.slice(0, 3).map((w) => (
          <AdCard key={w.adName} ad={w} tone="ok" />
        ))}
      </div>

      <div className="mt-5 mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--red)]">
        <TrendingDown className="h-3.5 w-3.5" /> Wasters ({creative.wasters.length})
      </div>
      <div className="space-y-2">
        {creative.wasters.length === 0 && (
          <Empty msg="No dead-weight ads detected." />
        )}
        {creative.wasters.slice(0, 3).map((w) => (
          <AdCard key={w.adName} ad={w} tone="critical" />
        ))}
      </div>
    </div>
  );
}

function AdCard({
  ad,
  tone,
}: {
  ad: AdScore;
  tone: "ok" | "critical";
}) {
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
        <div className="truncate text-xs font-bold text-white">
          {ad.headline || ad.adName}
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--text-dim)]">
          {ad.body || ad.campaignName}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
          <Metric label="Spend" value={`$${ad.spend.toLocaleString()}`} />
          <Metric
            label="CPL"
            value={ad.cpl > 0 ? `$${ad.cpl.toFixed(2)}` : "—"}
          />
          <Metric label="CTR" value={`${ad.ctr.toFixed(2)}%`} />
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
      <div className="text-[8px] uppercase tracking-wider text-[#444]">
        {label}
      </div>
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
