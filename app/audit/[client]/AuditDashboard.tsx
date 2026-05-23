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
import PlacementsPanel from "@/components/audit/PlacementsPanel";
import DevicesPanel from "@/components/audit/DevicesPanel";
import TimeOfDayPanel from "@/components/audit/TimeOfDayPanel";
import RecommendationCards from "@/components/audit/RecommendationCards";
import AuditRibbon from "@/components/audit/AuditRibbon";
import BenchmarkStatus from "@/components/audit/BenchmarkStatus";
import InteractiveFunnelExplorer from "@/components/visualizers/InteractiveFunnelExplorer";
import TimeSeriesScrubber from "@/components/visualizers/TimeSeriesScrubber";
import GeoBudgetReallocator from "@/components/visualizers/GeoBudgetReallocator";
import dynamic from "next/dynamic";
import DensityControl, { type Density } from "@/components/audit/DensityControl";
import { Languages } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const CanvasMapPanel = dynamic(() => import("@/components/audit/CanvasMapPanel"), { ssr: false });

interface Props {
  audit: AuditResult;
  clientSlug: string;
  clientSubtitle?: string;
  agencyLogo?: string;
  agencyLogoLight?: string;
  clientLogo?: string;
  clientLogoLight?: string;
  industry: string;
  industryOptions: { key: string; label: string }[];
  /**
   * When true the dashboard renders in PDF-export layout: sidebar,
   * controls panel, header buttons, ribbon, and what-if banner are all
   * hidden. Used by the /api/audit/[client]/pdf route via ?print=true.
   */
  printMode?: boolean;
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
  const { t } = useLang();
  return (
    <button
      onClick={() => openReport(1)}
      className="flex items-center gap-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:bg-[rgba(255,0,0,0.1)]"
    >
      📊 {t("Interactive Report", "Full Report")}
    </button>
  );
}

/** Tiny child components so plain/pro toggle reaches strings inside the dashboard chrome. */
function EngineStatusLabel({ isPending }: { isPending: boolean }) {
  const { t } = useLang();
  return <>{isPending ? t("Recomputing…", "Updating…") : t("Engine: Live", "Connected")}</>;
}

function WhatIfPreviewBanner({
  liveCpl,
  liveCtr,
  originalCpl,
  originalCtr,
  onReset,
}: {
  liveCpl: number;
  liveCtr: number;
  originalCpl: number;
  originalCtr: number;
  onReset: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#fbbf2440] px-4 py-2.5 sm:px-10"
      style={{ background: "rgba(251,191,36,0.06)" }}
    >
      <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#fbbf24]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
        {t("WHAT-IF PREVIEW", "TRYING SOMETHING NEW")} —{" "}
        {t("CPL target", "lead cost goal")} ${liveCpl} ·{" "}
        {t("CTR target", "click rate goal")} {liveCtr.toFixed(1)}%
        <span className="text-[#fbbf2480]">
          ({t("original analysis:", "your real numbers:")}{" "}
          {t("CPL", "lead cost")} ${originalCpl} ·{" "}
          {t("CTR", "click rate")} {originalCtr.toFixed(1)}%)
        </span>
      </div>
      <button
        onClick={onReset}
        className="border border-[#fbbf2440] px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-[#fbbf24] transition-colors hover:border-[#fbbf24] hover:bg-[rgba(251,191,36,0.1)]"
      >
        {t("← Reset to original", "← Go back to real numbers")}
      </button>
    </div>
  );
}

function MethodologyNote() {
  const { t } = useLang();
  return (
    <p className="mt-2 text-[10px] leading-snug text-[var(--text-dim)]" style={{ maxWidth: 880 }}>
      <span className="font-mono uppercase tracking-wider">
        {t("Methodology:", "How we calculated this:")}
      </span>{" "}
      {t(
        "CPL is computed as total ad spend divided by lead-form submissions (Meta's \"Results\" column for Leads-objective campaigns). For Traffic-objective campaigns, CPC (cost per click) is shown instead. Mixed-objective accounts use a weighted blend, documented per row.",
        "Cost per lead is just total money spent divided by how many lead forms got filled out. For ads that only buy clicks (not leads), we show cost per click instead. If you have a mix, we blend them — see each row's note for which is being used.",
      )}
    </p>
  );
}

export default function AuditDashboard({
  audit,
  clientSlug,
  clientSubtitle,
  agencyLogo,
  agencyLogoLight,
  clientLogo,
  clientLogoLight,
  industry,
  industryOptions,
  printMode = false,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // useLang inside the LangProvider tree — see <LangProvider> in JSX below.
  // Strings rendered before <LangProvider> mount get the default (plain).

  // Live benchmark state — updates instantly as sliders drag (no server round-trip)
  const [liveCpl, setLiveCpl] = useState(audit.benchmarks.targetCpl);
  const [liveCtr, setLiveCtr] = useState(audit.benchmarks.targetCtr);

  // Dashboard density — Compact / Normal / Comfortable. Persisted in
  // localStorage. Wraps the main content column in a transform-scaled
  // div; side panels (Sidebar, ControlsPanel) are intentionally outside
  // this wrapper so they stay full-size.
  const [density, setDensity] = useState<Density>("normal");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard-density") as Density | null;
      if (saved === "compact" || saved === "normal" || saved === "comfortable") {
        setDensity(saved);
      }
    } catch {}
  }, []);
  const setDensityPersisted = (d: Density) => {
    setDensity(d);
    try { localStorage.setItem("dashboard-density", d); } catch {}
  };

  // Sync when server re-renders with committed URL params
  useEffect(() => { setLiveCpl(audit.benchmarks.targetCpl); }, [audit.benchmarks.targetCpl]);
  useEffect(() => { setLiveCtr(audit.benchmarks.targetCtr); }, [audit.benchmarks.targetCtr]);

  // The benchmarks the server actually used — stays fixed until URL changes
  const originalCpl = audit.benchmarks.targetCpl;
  const originalCtr = audit.benchmarks.targetCtr;
  const isPreview = liveCpl !== originalCpl || liveCtr !== originalCtr;

  // Single URL update — supports batching multiple params in one replace
  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(search.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      router.replace(`/audit/${clientSlug}?${next.toString()}`, { scroll: false });
    });
  };

  // Batch update — fixes industry selector race where individual updateParam calls clobber each other
  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.replace(`/audit/${clientSlug}?${next.toString()}`, { scroll: false });
    });
  };

  const resetToOriginal = () => {
    setLiveCpl(originalCpl);
    setLiveCtr(originalCtr);
  };

  return (
    <LangProvider>
      <ReportProvider>
        <div
          className={printMode ? "min-h-screen print-mode" : "flex h-screen overflow-hidden"}
        >
          {/* Left nav rail — hidden in PDF export mode */}
          {!printMode && (
            <Sidebar
              clientName={audit.clientName}
              clientSubtitle={clientSubtitle}
              primaryLeak={audit.funnel.primaryLeak}
              clientSlug={clientSlug}
              agencyLogo={agencyLogo}
              agencyLogoLight={agencyLogoLight}
              clientLogo={clientLogo}
              clientLogoLight={clientLogoLight}
            />
          )}

          {/* Center column scrolls independently — controls panel stays fixed alongside */}
          <main className={printMode ? "min-w-0" : "flex-1 min-w-0 overflow-y-auto pt-[52px] lg:pt-0"} id="audit-main">
            {/* Sticky header — non-sticky / no controls in print mode */}
            <header
              className={
                printMode
                  ? "flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-10 sm:py-6"
                  : "sticky top-0 z-30 flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-10 sm:py-6"
              }
              style={printMode ? undefined : { background: "var(--header-bg, rgba(3,3,3,0.9))" }}
            >
              <h1
                className="truncate text-sm font-bold tracking-tight sm:text-lg"
                style={{ fontFamily: "var(--font-head)" }}
              >
                FORENSIC AUDIT: {audit.clientName.toUpperCase()}
              </h1>
              {!printMode && (
                <div className="flex flex-wrap items-center gap-2">
                  <ReportOpenButton />
                  <HeaderLangToggle />
                  <ThemeToggle />
                  <div className="flex items-center gap-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] sm:gap-3 sm:px-3">
                    <div className="pulse" />
                    <EngineStatusLabel isPending={isPending} />
                  </div>
                </div>
              )}
            </header>

            {/* Preview mode banner — shown when sliders differ from server-rendered benchmarks */}
            {!printMode && isPreview && (
              <WhatIfPreviewBanner
                liveCpl={liveCpl}
                liveCtr={liveCtr}
                originalCpl={originalCpl}
                originalCtr={originalCtr}
                onReset={resetToOriginal}
              />
            )}

            {/* Fact ribbon (below sticky header, not sticky itself) */}
            {!printMode && <AuditRibbon audit={audit} />}

            {!printMode && (
              <DensityControl density={density} onChange={setDensityPersisted} />
            )}
            <div
              style={
                printMode
                  ? undefined
                  : {
                      transform: `scale(${density === "compact" ? 0.85 : density === "comfortable" ? 1.15 : 1})`,
                      transformOrigin: "top left",
                      width: `calc(100% / ${density === "compact" ? 0.85 : density === "comfortable" ? 1.15 : 1})`,
                      transition: "transform 180ms ease-out",
                    }
              }
            >
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
                  isPreview={isPreview}
                />
                <MethodologyNote />
              </section>

              {/* Benchmark status strip — makes slider effects immediately visible */}
              <section className="col-span-12">
                <BenchmarkStatus
                  blendedCpl={audit.spend.blendedCpl}
                  weightedCtr={audit.spend.weightedCtr}
                  liveCpl={liveCpl}
                  liveCtr={liveCtr}
                  industry={industry}
                  reportingPeriod={audit.reportingPeriod}
                  isPreview={isPreview}
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
                {/* Lead-objective campaigns → "CPL"; otherwise the
                    Results column is link clicks, so the per-region cost
                    is really CPC. Choose label honestly. */}
                <GeographicHeatmap
                  geo={audit.geo}
                  liveCpl={liveCpl}
                  costMetricLabel={audit.spend.blendedCpl > 0 ? "CPL" : "CPC"}
                />
              </section>
              <section id="creative" className="col-span-12 lg:col-span-6">
                <CreativeAnalysisGrid creative={audit.creative} liveCpl={liveCpl} />
              </section>

              {/* Interactive visualisers (Tier 2) — slot in between Geo/Creative and Demographics */}
              {!printMode && (
                <>
                  <section id="funnel-explorer" className="col-span-12 lg:col-span-6">
                    <InteractiveFunnelExplorer
                      funnel={audit.funnel}
                      blendedCpl={audit.spend.blendedCpl}
                    />
                  </section>
                  <section id="weekly-scrubber" className="col-span-12 lg:col-span-6">
                    <TimeSeriesScrubber weeks={audit.weeklySeries} />
                  </section>
                  {audit.geo.regions.length > 0 && (
                    <section id="geo-reallocator" className="col-span-12">
                      <GeoBudgetReallocator geo={audit.geo} />
                    </section>
                  )}
                </>
              )}

              {/* Demographics (age/gender CPL breakdown) */}
              {audit.demographics.brackets.some((b) => b.spend > 0) && (
                <section id="demographics" className="col-span-12">
                  <DemographicsPanel demographics={audit.demographics} targetCpl={liveCpl} />
                </section>
              )}

              {/* Placement + Device breakdown */}
              {audit.placements.placements.length > 0 && (
                <section id="placements" className="col-span-12 lg:col-span-6">
                  <PlacementsPanel placements={audit.placements} targetCpl={liveCpl} />
                </section>
              )}
              {audit.devices.devices.length > 0 && (
                <section id="devices" className="col-span-12 lg:col-span-6">
                  <DevicesPanel devices={audit.devices} />
                </section>
              )}

              {/* Dayparting / Time-of-day analysis */}
              {audit.timeOfDay.hours.length > 0 && (
                <section id="dayparting" className="col-span-12">
                  <TimeOfDayPanel timeOfDay={audit.timeOfDay} />
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
            </div>
          </main>

          {/* Right controls rail — hidden in PDF export mode */}
          {!printMode && (
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
              onBatchChange={updateParams}
              isPending={isPending}
              onReset={resetToOriginal}
              reportingPeriod={audit.reportingPeriod}
            />
          )}
        </div>
      </ReportProvider>
    </LangProvider>
  );
}
