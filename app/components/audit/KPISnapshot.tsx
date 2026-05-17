"use client";

import type { KpiCard } from "@/engine/types";
import { useLang } from "@/context/LangContext";

interface Props {
  kpis: KpiCard[];
}

const STATUS_DOT: Record<string, string> = {
  ok: "#4ade80",
  warn: "#fbbf24",
  critical: "#ff0000",
};

// Short display labels replacing the engine's internal keys
const PRO_DISPLAY: Record<string, string> = {
  Budget_Reconciled:   "TOTAL SPEND",
  Campaign_Efficiency: "CTR",
  Control_CPL:         "BLENDED CPL",
  Lead_Volume:         "LEADS",
  Reach_Saturation:    "FREQUENCY",
  Auction_Cost:        "CPM",
  Attribution_Health:  "ATTRIBUTION",
};

const PLAIN_DISPLAY: Record<string, string> = {
  Budget_Reconciled:   "MONEY SPENT",
  Campaign_Efficiency: "CLICK RATE",
  Control_CPL:         "COST PER LEAD",
  Lead_Volume:         "LEADS",
  Reach_Saturation:    "REPEAT VIEWS",
  Auction_Cost:        "PER 1K VIEWS",
  Attribution_Health:  "TRACKING",
};

const PLAIN_UNIT: Record<string, string> = {
  "Total Audited Spend":        "Total ad spend",
  "Weighted CTR (Avg)":         "% who clicked your ad",
  "Blended CPL":                "Avg cost per lead",
  "Tracked Leads":              "Leads captured",
  "Avg Frequency":              "Times same person saw your ads",
  "Weighted CPM":               "Cost per 1,000 views",
  "Campaigns w/ Attribution":   "Campaigns being tracked",
};

const PLAIN_BENCHMARK: Record<string, (v: string) => string> = {
  "Target:": (s) => s.replace("Target:", "Goal:"),
  "Target Benchmark:": (s) => s.replace("Target Benchmark:", "Goal:"),
  "Healthy <2.5, fatigue >4": () => "Good below 2.5, bad above 4",
  "Cost per 1,000 impressions": () => "Price to show your ad 1,000 times",
  "Want 100% set": () => "Goal: all campaigns tracked",
};

function translateBenchmark(raw: string): string {
  for (const [key, fn] of Object.entries(PLAIN_BENCHMARK)) {
    if (raw.startsWith(key) || raw === key) return fn(raw);
  }
  return raw;
}

export default function KPISnapshot({ kpis }: Props) {
  const { t, plain } = useLang();

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4" style={{ minWidth: "max-content" }}>
        {kpis.map((k) => {
          const displayLabel = plain
            ? (PLAIN_DISPLAY[k.label] ?? k.label.replace(/_/g, " "))
            : (PRO_DISPLAY[k.label] ?? k.label);
          const displayUnit = plain ? (PLAIN_UNIT[k.unit] ?? k.unit) : k.unit;
          const displayBenchmark = plain ? translateBenchmark(k.benchmark) : k.benchmark;

          return (
            <div
              key={k.label}
              className="relative border border-[var(--border)] bg-[var(--card)] p-5 flex-shrink-0"
              style={{ width: "clamp(148px, 13vw, 200px)" }}
              title={k.label}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)] leading-tight">
                  {displayLabel}
                </div>
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: STATUS_DOT[k.status] ?? "#666" }}
                />
              </div>
              <div className="stat-val">{k.value}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-dim)] leading-snug">
                {displayUnit}
              </div>
              <div className="mt-3 border-t border-[var(--border)] pt-2 font-mono text-[9px] text-[var(--text-dim)] leading-snug">
                {displayBenchmark}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
