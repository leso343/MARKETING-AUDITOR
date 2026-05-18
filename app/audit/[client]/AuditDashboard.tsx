"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuditResult } from "@/engine/runAudit";
import { LangProvider, useLang } from "@/context/LangContext";
import { ReportProvider, useReport } from "@/context/ReportContext";
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
import AuditRibbon from "@/components/audit/AuditRibbon";
import dynamic from "next/dynamic";
import { Languages } from "lucide-react";

const CanvasMapPanel = dynamic(() => import("@/components/audit/CanvasMapPanel"), { ssr: false });

interface Props {
  audit: AuditResult;
  clientSlug: string;
  clientSubtitle?: string;
  agencyLogo?: string;
  clientLogo?: string;
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

/** Button that opens the report viewer via ReportContext */
function ReportOpenButton() {
  const { openReport } = useReport();
  return (
    <button
      onClick={() => openReport(1)}
      className="flex items-center gap-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:bg-[rgba(255,0,0,0.1)]"
    >
      📊 Interactive Report
    </button>
  );
}

export default function AuditDashboard({
  audit,
  clientSlug,
  clientSubtitle,
  agencyLogo,
  clientLogo,
  industry,
  industryOptions,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Live benchmark state — updates instantly as sliders drag (no server round-trip)
  const [liveCpl, setLiveCpl] = useState(audit.benchmarks.targetCpl);
  const [liveCtr, setLiveCtr] = useState(audit.benchmarks.targetCtr);

  // Sync when server re-renders with committed URL params
  useEffect(() => { setLiveCpl(audit.benchmarks.targetCpl); }, [audit.benchmarks.targetCpl]);
  useEffect(() => { setLiveCtr(audit.benchmarks.targetCtr); }, [audit.benchmarks.targetCtr]);

  // The benchmarks the server actually used — stays fixed until URL changes
  const originalCpl = audit.benchmarks.targetCpl;
  const originalCtr = audit.benchmarks.targetCtr;
  const isPreview = liveCpl !== originalCpl || liveCtr !== originalCtr;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(search.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.replace(`/audit/${clientSlug}?${next.toString()}`, { scroll: false });
    });
  };

  const resetToOriginal = () => {
    setLiveCpl(originalCpl);
    setLiveCtr(originalCtr);
  };

  const pdfPath = "/SNA_Marketing_TakeCharge_Audit.pdf";

  return (
    <LangProvider>
      <ReportProvider>
        <div className="flex min-h-screen overflow-x-hidden">
          {/* Left nav rail */}
          <Sidebar
            clientName={audit.clientName}
            clientSubtitle={clientSubtitle}
            primaryLeak={audit.funnel.primaryLeak}
            pdfPath={pdfPath}
            agencyLogo={agencyLogo}
            clientLogo={clientLogo}
          />

          {/* Center column — pt-[52px] offsets the fixed mobile nav bar */}
          <main className="flex-1 min-w-0 overflow-y-auto pt-[52px] lg:pt-0">
            {/* Sticky header */}
            <header
              className="sticky top-0 z-30 flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-10 sm:py-6"
              style={{ background: "rgba(3,3,3,0.9)" }}
            >
              <h1
                className="truncate text-sm font-bold tracking-tight sm:text-lg"
                style={{ fontFamily: "var(--font-head)" }}
              >
                FORENSIC AUDIT: {audit.clientName.toUpperCase()}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <ReportOpenButton />
                <HeaderLangToggle />
                <div className="flex items-center gap-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] sm:gap-3 sm:px-3">
                  <div className="pulse" />
                  {isPending ? "Recomputing…" : "Engine: Live"}
                </div>
              </div>
            </header>

            {/* Preview mode banner — shown when sliders differ from server-rendered benchmarks */}
            {isPreview && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#fbbf2440] px-4 py-2.5 sm:px-10"
                style={{ background: "rgba(251,191,36,0.06)" }}
              >
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#fbbf24]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
                  WHAT-IF PREVIEW — CPL target ${liveCpl} · CTR target {liveCtr.toFixed(1)}%
                  <span className="text-[#fbbf2480]">
                    (original analysis: CPL ${originalCpl} · CTR {originalCtr.toFixed(1)}%)
                  </span>
                </div>
                <button
                  onClick={resetToOriginal}
                  className="border border-[#fbbf2440] px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-[#fbbf24] transition-colors hover:border-[#fbbf24] hover:bg-[rgba(251,191,36,0.1)]"
                >
                  ← Reset to original
                </button>
              </div>
            )}

            {/* Fact ribbon (below sticky header, not sticky itself) */}
            <AuditRibbon audit={audit} />

            <div className="grid grid-cols-12 gap-4 p-4 sm:gap-5 sm:p-6 lg:p-10">
              {/* Executive summary */}
              <section id="overview" className="col-span-12">
                <ExecutiveSummary audit={audit} />
              </section>

              {/* KPI snapshot */}
              <section className="col-span-12">
                <KPISnapshot
                  kpis={audit.spend.kpis}
                  liveCpl={liveCpl}
                  liveCtr={liveCtr}
                  blendedCpl={audit.spend.blendedCpl}
                  weightedCtr={audit.spend.weightedCtr}
                />
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
                  <DemographicsPanel demographics={audit.demographics} targetCpl={liveCpl} />
                </section>
              )}

              {/* Canvas priority map */}
              <section id="canvas-map" className="col-span-12">
                <CanvasMapPanel />
              </section>

              {/* Recommendations */}
              <section id="plan" className="col-span-12">
                <RecommendationCards audit={audit} targetCpl={liveCpl} targetCtr={liveCtr} />
              </section>
            </div>
          </main>

          {/* Right controls rail */}
          <ControlsPanel
            targetCpl={liveCpl}
            targetCtr={liveCtr}
            originalCpl={originalCpl}
            originalCtr={originalCtr}
            onLiveCpl={setLiveCpl}
            onLiveCtr={setLiveCtr}
            industry={industry}
            industryOptions={industryOptions}
            onChange={updateParam}
            isPending={isPending}
            onReset={resetToOriginal}
          />
        </div>
      </ReportProvider>
    </LangProvider>
  );
}
