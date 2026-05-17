"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuditResult } from "@/engine/runAudit";
import { LangProvider, useLang } from "@/context/LangContext";
import Sidebar from "@/components/audit/Sidebar";
import ControlsPanel from "@/components/audit/ControlsPanel";
import ExecutiveSummary from "@/components/audit/ExecutiveSummary";
import KPISnapshot from "@/components/audit/KPISnapshot";
import FunnelLeakageChart from "@/components/audit/FunnelLeakageChart";
import TrackingFailuresPanel from "@/components/audit/TrackingFailuresPanel";
import GeographicHeatmap from "@/components/audit/GeographicHeatmap";
import CreativeAnalysisGrid from "@/components/audit/CreativeAnalysisGrid";
import DemographicsPanel from "@/components/audit/DemographicsPanel";
import RecommendationCards from "@/components/audit/RecommendationCards";
import { Languages } from "lucide-react";

interface Props {
  audit: AuditResult;
  clientSlug: string;
  industry: string;
  industryOptions: { key: string; label: string }[];
}

/** Small client component that can call useLang inside the LangProvider tree. */
function HeaderLangToggle() {
  const { plain, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      title={plain ? "Switch to Agency Mode" : "Switch to Plain English"}
      className="flex items-center gap-2 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors"
      style={{
        borderColor: plain ? "#4ade80" : "var(--red-dim)",
        background: plain ? "rgba(74,222,128,0.05)" : "rgba(255,0,0,0.05)",
        color: plain ? "#4ade80" : "var(--red)",
      }}
    >
      <Languages className="h-3 w-3" />
      {plain ? "Plain English" : "Agency Mode"}
    </button>
  );
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
      router.replace(`/audit/${clientSlug}?${next.toString()}`, { scroll: false });
    });
  };

  const pdfPath = "/SNA_Marketing_TakeCharge_Audit.pdf";

  return (
    <LangProvider>
      <div className="flex min-h-screen">
        {/* Left nav rail */}
        <Sidebar
          clientName={audit.clientName}
          primaryLeak={audit.funnel.primaryLeak}
          pdfPath={pdfPath}
        />

        {/* Center column */}
        <main className="flex-1 overflow-y-auto">
          {/* Sticky header */}
          <header
            className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] px-10 py-6 backdrop-blur-xl"
            style={{ background: "rgba(3,3,3,0.9)" }}
          >
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              FORENSIC AUDIT: {audit.clientName.toUpperCase()}
            </h1>
            <div className="flex items-center gap-3">
              <HeaderLangToggle />
              <div className="flex items-center gap-3 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)]">
                <div className="pulse" />
                {isPending ? "Recomputing…" : "Engine: Live"}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-5 p-10">
            {/* Executive summary */}
            <section id="overview" className="col-span-12">
              <ExecutiveSummary audit={audit} />
            </section>

            {/* KPI snapshot */}
            <section className="col-span-12">
              <KPISnapshot kpis={audit.spend.kpis} />
            </section>

            {/* Funnel + Tracking */}
            <section id="leakage" className="col-span-12 lg:col-span-7">
              <FunnelLeakageChart funnel={audit.funnel} />
            </section>
            <section id="tracking" className="col-span-12 lg:col-span-5">
              <TrackingFailuresPanel tracking={audit.tracking} />
            </section>

            {/* Geo + Creative */}
            <section id="geo" className="col-span-12 lg:col-span-6">
              <GeographicHeatmap geo={audit.geo} />
            </section>
            <section id="creative" className="col-span-12 lg:col-span-6">
              <CreativeAnalysisGrid creative={audit.creative} />
            </section>

            {/* Demographics (age/gender CPL breakdown) */}
            {audit.demographics.brackets.some((b) => b.spend > 0) && (
              <section id="demographics" className="col-span-12">
                <DemographicsPanel demographics={audit.demographics} />
              </section>
            )}

            {/* Recommendations */}
            <section id="plan" className="col-span-12">
              <RecommendationCards audit={audit} />
            </section>
          </div>
        </main>

        {/* Right controls rail */}
        <ControlsPanel
          targetCpl={audit.benchmarks.targetCpl}
          targetCtr={audit.benchmarks.targetCtr}
          industry={industry}
          industryOptions={industryOptions}
          onChange={updateParam}
          isPending={isPending}
        />
      </div>
    </LangProvider>
  );
}
