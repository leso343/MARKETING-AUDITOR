"use client";

/**
 * AuditDashboard — orchestrates the live dashboard.
 *
 * Receives a server-rendered AuditResult and lets the user re-tune benchmarks
 * via the right-sidebar controls. Changes push to the URL as query params, so
 * the server re-runs the engine and re-renders — the experience feels live
 * but the heavy lifting stays on the server.
 */
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuditResult } from "@/engine/runAudit";
import Sidebar from "@/components/audit/Sidebar";
import ControlsPanel from "@/components/audit/ControlsPanel";
import ExecutiveSummary from "@/components/audit/ExecutiveSummary";
import KPISnapshot from "@/components/audit/KPISnapshot";
import FunnelLeakageChart from "@/components/audit/FunnelLeakageChart";
import TrackingFailuresPanel from "@/components/audit/TrackingFailuresPanel";
import GeographicHeatmap from "@/components/audit/GeographicHeatmap";
import CreativeAnalysisGrid from "@/components/audit/CreativeAnalysisGrid";
import RecommendationCards from "@/components/audit/RecommendationCards";

interface Props {
  audit: AuditResult;
  clientSlug: string;
  industry: string;
  industryOptions: { key: string; label: string }[];
}

export default function AuditDashboard({
  audit,
  clientSlug,
  industry,
  industryOptions,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(search.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.replace(`/audit/${clientSlug}?${next.toString()}`, {
        scroll: false,
      });
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left nav rail */}
      <Sidebar
        clientName={audit.clientName}
        primaryLeak={audit.funnel.primaryLeak}
      />

      {/* Center column */}
      <main className="flex-1 overflow-y-auto">
        {/* sticky header */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] px-10 py-6 backdrop-blur-xl"
          style={{ background: "rgba(3,3,3,0.9)" }}
        >
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            FORENSIC AUDIT: {audit.clientName.toUpperCase()}
          </h1>
          <div className="flex items-center gap-3 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)]">
            <div className="pulse" />
            {isPending ? "Recomputing…" : "Engine: Live"}
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5 p-10">
          {/* Executive summary spans full width */}
          <section id="overview" className="col-span-12">
            <ExecutiveSummary audit={audit} />
          </section>

          {/* KPI snapshot — 7 cards */}
          <section className="col-span-12">
            <KPISnapshot kpis={audit.spend.kpis} />
          </section>

          {/* Funnel + Tracking — side-by-side */}
          <section id="leakage" className="col-span-12 lg:col-span-7">
            <FunnelLeakageChart funnel={audit.funnel} />
          </section>
          <section id="tracking" className="col-span-12 lg:col-span-5">
            <TrackingFailuresPanel tracking={audit.tracking} />
          </section>

          {/* Geo + Creative — side-by-side */}
          <section id="geo" className="col-span-12 lg:col-span-6">
            <GeographicHeatmap geo={audit.geo} />
          </section>
          <section id="creative" className="col-span-12 lg:col-span-6">
            <CreativeAnalysisGrid creative={audit.creative} />
          </section>

          {/* Recommendations — full width */}
          <section id="plan" className="col-span-12">
            <RecommendationCards audit={audit} />
          </section>
        </div>
      </main>

      {/* Right controls rail (sticky) */}
      <ControlsPanel
        targetCpl={audit.benchmarks.targetCpl}
        targetCtr={audit.benchmarks.targetCtr}
        industry={industry}
        industryOptions={industryOptions}
        onChange={updateParam}
        isPending={isPending}
      />
    </div>
  );
}
