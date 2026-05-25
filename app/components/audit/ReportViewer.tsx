"use client";

/**
 * ReportViewer — full-screen branded "Forensic Audit Report" overlay.
 *
 * Replaces the prior implementation that loaded a static
 * /campaign_report.html in an iframe (hardcoded to one client and
 * blocked by the production CSP). Now renders live React content
 * using the same dashboard components that power the audit page, so
 * it always reflects the CURRENT client + benchmarks and automatically
 * inherits the agency's BrandTheme colors and logo.
 *
 * Four sections, each a self-contained "page" within the overlay:
 *   1. Diagnostic       — health snapshot + funnel + tracking
 *   2. Creative & Age   — winners/losers + demographics + placements
 *   3. 30-Day Roadmap   — recommendations + weekly trend
 *   4. Geo Audit        — geographic deep-dive
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, Printer, ChevronLeft } from "lucide-react";
import type { AuditResult } from "@/engine/runAudit";
import type { ReportBranding } from "@/context/ReportContext";
import ExecutiveSummary from "@/components/audit/ExecutiveSummary";
import KPISnapshot from "@/components/audit/KPISnapshot";
import BenchmarkStatus from "@/components/audit/BenchmarkStatus";
import FunnelLeakageChart from "@/components/audit/FunnelLeakageChart";
import TrackingFailuresPanel from "@/components/audit/TrackingFailuresPanel";
import CreativeAnalysisGrid from "@/components/audit/CreativeAnalysisGrid";
import DemographicsPanel from "@/components/audit/DemographicsPanel";
import PlacementsPanel from "@/components/audit/PlacementsPanel";
import DevicesPanel from "@/components/audit/DevicesPanel";
import RecommendationCards from "@/components/audit/RecommendationCards";
import GeographicHeatmap from "@/components/audit/GeographicHeatmap";
import AuditRibbon from "@/components/audit/AuditRibbon";
import TimeOfDayPanel from "@/components/audit/TimeOfDayPanel";
import InteractiveFunnelExplorer from "@/components/visualizers/InteractiveFunnelExplorer";
import TimeSeriesScrubber from "@/components/visualizers/TimeSeriesScrubber";
import GeoBudgetReallocator from "@/components/visualizers/GeoBudgetReallocator";

// Leaflet-based map — same dynamic import pattern the dashboard uses.
const CanvasMapPanel = dynamic(
  () => import("@/components/audit/CanvasMapPanel"),
  { ssr: false },
);

interface Props {
  open: boolean;
  page: number;
  onClose: () => void;
  audit: AuditResult;
  liveCpl: number;
  liveCtr: number;
  industry: string;
  branding: ReportBranding;
}

const PAGE_TABS = [
  { label: "Diagnostic",     page: 1, subtitle: "Health snapshot · Funnel · Tracking" },
  { label: "Creative & Age", page: 2, subtitle: "Winners · Demographics · Placements" },
  { label: "30-Day Roadmap", page: 3, subtitle: "Recommendations · Weekly trend" },
  { label: "Geo Audit",      page: 4, subtitle: "Geographic deep-dive" },
];

export default function ReportViewer({
  open,
  page,
  onClose,
  audit,
  liveCpl,
  liveCtr,
  industry,
  branding,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [activePage, setActivePage] = useState(page);

  // Sync activePage when prop changes externally
  useEffect(() => {
    if (open) setActivePage(page);
  }, [page, open]);

  // Lock/unlock body scroll
  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  // Fade-in
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Scroll to top of content on tab change
  useEffect(() => {
    const el = document.getElementById("report-scroll");
    if (el) el.scrollTop = 0;
  }, [activePage]);

  const onPickPage = useCallback((p: number) => setActivePage(p), []);

  const sectionSubtitle = useMemo(
    () => PAGE_TABS.find((t) => t.page === activePage)?.subtitle ?? "",
    [activePage],
  );
  const sectionLabel = useMemo(
    () => PAGE_TABS.find((t) => t.page === activePage)?.label.toUpperCase() ?? "",
    [activePage],
  );

  if (!open && !visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "var(--bg)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.32s ease, transform 0.32s ease",
      }}
    >
      {/* ── Top nav bar ─────────────────────────────────────────────── */}
      <nav
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-2 py-2 sm:px-4"
        style={{
          background: "var(--header-bg, rgba(6,6,6,0.96))",
          backdropFilter: "blur(8px)",
          scrollbarWidth: "none",
        }}
      >
        <button
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-[var(--text)] sm:px-3"
        >
          <ChevronLeft className="h-3 w-3" />
          <span className="hidden sm:inline">Back to dashboard</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="mx-1 h-4 w-px shrink-0 bg-[var(--border)] sm:mx-2" />

        {PAGE_TABS.map((tab) => (
          <button
            key={tab.page}
            onClick={() => onPickPage(tab.page)}
            className="shrink-0 border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors sm:px-3"
            style={{
              borderColor: activePage === tab.page ? "var(--red)" : "var(--border)",
              color: activePage === tab.page ? "var(--red)" : "var(--text-dim)",
              background: activePage === tab.page ? "rgba(255,0,0,0.07)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-[var(--text)] sm:px-3"
            title="Print report"
          >
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.05)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:bg-[rgba(255,0,0,0.12)] sm:px-3"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </nav>

      {/* ── Scrollable report content ───────────────────────────────── */}
      <div id="report-scroll" className="flex-1 overflow-y-auto">
        {/* Branded report header */}
        <ReportHeader
          branding={branding}
          clientName={audit.clientName}
          sectionLabel={sectionLabel}
          sectionSubtitle={sectionSubtitle}
          generatedAt={audit.generatedAt}
          reportingStart={audit.reportingPeriod.startDate}
          reportingEnd={audit.reportingPeriod.endDate}
        />

        {/* Section body */}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          {activePage === 1 && (
            <SectionDiagnostic
              audit={audit}
              liveCpl={liveCpl}
              liveCtr={liveCtr}
              industry={industry}
            />
          )}
          {activePage === 2 && (
            <SectionCreativeAndAge audit={audit} liveCpl={liveCpl} />
          )}
          {activePage === 3 && (
            <SectionRoadmap audit={audit} liveCpl={liveCpl} liveCtr={liveCtr} />
          )}
          {activePage === 4 && (
            <SectionGeoAudit audit={audit} liveCpl={liveCpl} />
          )}
        </div>

        {/* Branded footer */}
        <ReportFooter
          branding={branding}
          clientName={audit.clientName}
        />
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Branded header — agency logo + client + section info
   ═════════════════════════════════════════════════════════════════════ */
function ReportHeader({
  branding,
  clientName,
  sectionLabel,
  sectionSubtitle,
  generatedAt,
  reportingStart,
  reportingEnd,
}: {
  branding: ReportBranding;
  clientName: string;
  sectionLabel: string;
  sectionSubtitle: string;
  generatedAt: string;
  reportingStart: string | null;
  reportingEnd: string | null;
}) {
  // Picking variant via CSS media query at runtime is messy; the
  // existing dashboard uses dark variants by default and html.light
  // override flips them via custom CSS. We follow the same pattern.
  const agencyLogo = branding.agencyLogo;
  const clientLogo = branding.clientLogo;

  return (
    <div
      className="border-b"
      style={{
        background: "linear-gradient(180deg, var(--card), var(--bg))",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Top row: agency brand left, client brand right */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {agencyLogo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={agencyLogo}
                alt="Agency logo"
                className="h-9 sm:h-10 w-auto object-contain"
                style={{ maxWidth: "180px" }}
              />
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
                Blank Page Audits
              </div>
            )}
          </div>

          {clientLogo && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)] hidden sm:inline">
                Prepared for
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clientLogo}
                alt={`${clientName} logo`}
                className="h-8 sm:h-9 w-auto object-contain"
                style={{ maxWidth: "140px" }}
              />
            </div>
          )}
        </div>

        {/* Section title block */}
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[3px] mb-2"
            style={{ color: "var(--red)" }}
          >
            &gt; Forensic Audit Report &nbsp;·&nbsp; {sectionLabel}
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {clientName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-dim)]">{sectionSubtitle}</p>
        </div>

        {/* Meta row: reporting period + generated date */}
        <div className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
          {reportingStart && reportingEnd && (
            <span>
              Reporting period · <span className="text-[var(--text)]">{reportingStart}</span>{" "}
              → <span className="text-[var(--text)]">{reportingEnd}</span>
            </span>
          )}
          <span>
            Generated ·{" "}
            <span className="text-[var(--text)]">
              {new Date(generatedAt).toLocaleString()}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Footer — small branded sign-off
   ═════════════════════════════════════════════════════════════════════ */
function ReportFooter({
  branding,
  clientName,
}: {
  branding: ReportBranding;
  clientName: string;
}) {
  return (
    <div
      className="border-t mt-8 py-6"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {branding.agencyLogo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={branding.agencyLogo}
              alt=""
              className="h-6 w-auto object-contain opacity-70"
              style={{ maxWidth: "120px" }}
            />
          )}
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Forensic audit prepared for {clientName}
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
          Powered by Blank Page Audits
        </span>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Section 1 — DIAGNOSTIC
   Full health snapshot. AuditRibbon → ExecutiveSummary → KPIs →
   Benchmarks → Funnel chart → Interactive funnel explorer →
   Tracking → Weekly trend chart.
   ═════════════════════════════════════════════════════════════════════ */
function SectionDiagnostic({
  audit,
  liveCpl,
  liveCtr,
  industry,
}: {
  audit: AuditResult;
  liveCpl: number;
  liveCtr: number;
  industry: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-5">
      {/* Fact ribbon — quick at-a-glance numbers */}
      <section className="col-span-12">
        <AuditRibbon audit={audit} />
      </section>

      <section className="col-span-12">
        <ExecutiveSummary audit={audit} />
      </section>

      <section className="col-span-12">
        <KPISnapshot
          kpis={audit.spend.kpis}
          liveCpl={liveCpl}
          liveCtr={liveCtr}
          blendedCpl={audit.spend.blendedCpl}
          weightedCtr={audit.spend.weightedCtr}
          isPreview={false}
        />
      </section>

      <section className="col-span-12">
        <BenchmarkStatus
          blendedCpl={audit.spend.blendedCpl}
          weightedCtr={audit.spend.weightedCtr}
          liveCpl={liveCpl}
          liveCtr={liveCtr}
          industry={industry}
          reportingPeriod={audit.reportingPeriod}
          isPreview={false}
        />
      </section>

      <section className="col-span-12 lg:col-span-7">
        <FunnelLeakageChart funnel={audit.funnel} />
      </section>
      <section className="col-span-12 lg:col-span-5">
        <TrackingFailuresPanel tracking={audit.tracking} />
      </section>

      {/* Interactive funnel — same component as the dashboard */}
      <section className="col-span-12">
        <InteractiveFunnelExplorer
          funnel={audit.funnel}
          blendedCpl={audit.spend.blendedCpl}
        />
      </section>

      {/* Weekly trend — scrubber chart */}
      {audit.weeklySeries.length > 0 && (
        <section className="col-span-12">
          <TimeSeriesScrubber weeks={audit.weeklySeries} />
        </section>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Section 2 — CREATIVE & AGE
   Creative winners/losers + demographics + placements + devices +
   dayparting if data exists.
   ═════════════════════════════════════════════════════════════════════ */
function SectionCreativeAndAge({
  audit,
  liveCpl,
}: {
  audit: AuditResult;
  liveCpl: number;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-5">
      <section className="col-span-12">
        <CreativeAnalysisGrid creative={audit.creative} liveCpl={liveCpl} />
      </section>

      {audit.demographics.brackets.some((b) => b.spend > 0) && (
        <section className="col-span-12">
          <DemographicsPanel demographics={audit.demographics} targetCpl={liveCpl} />
        </section>
      )}

      {audit.placements.placements.length > 0 && (
        <section className="col-span-12 lg:col-span-6">
          <PlacementsPanel placements={audit.placements} targetCpl={liveCpl} />
        </section>
      )}
      {audit.devices.devices.length > 0 && (
        <section className="col-span-12 lg:col-span-6">
          <DevicesPanel devices={audit.devices} />
        </section>
      )}

      {audit.timeOfDay.hours.length > 0 && (
        <section className="col-span-12">
          <TimeOfDayPanel timeOfDay={audit.timeOfDay} />
        </section>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Section 3 — 30-DAY ROADMAP
   Action plan + weekly trend so the roadmap is anchored in real
   momentum.
   ═════════════════════════════════════════════════════════════════════ */
function SectionRoadmap({
  audit,
  liveCpl,
  liveCtr,
}: {
  audit: AuditResult;
  liveCpl: number;
  liveCtr: number;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-5">
      <section className="col-span-12">
        <RecommendationCards audit={audit} targetCpl={liveCpl} targetCtr={liveCtr} />
      </section>

      {audit.weeklySeries.length > 0 && (
        <section className="col-span-12">
          <TimeSeriesScrubber weeks={audit.weeklySeries} />
        </section>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Section 4 — GEO AUDIT
   Heatmap + the canvas/leaflet map + interactive geo reallocator.
   ═════════════════════════════════════════════════════════════════════ */
function SectionGeoAudit({
  audit,
  liveCpl,
}: {
  audit: AuditResult;
  liveCpl: number;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 sm:gap-5">
      <section className="col-span-12">
        <GeographicHeatmap
          geo={audit.geo}
          liveCpl={liveCpl}
          costMetricLabel={audit.spend.blendedCpl > 0 ? "CPL" : "CPC"}
        />
      </section>

      {/* The actual map — Leaflet-backed, loaded client-side */}
      <section className="col-span-12">
        <CanvasMapPanel />
      </section>

      {audit.geo.regions.length > 0 && (
        <section className="col-span-12">
          <GeoBudgetReallocator geo={audit.geo} />
        </section>
      )}
    </div>
  );
}
