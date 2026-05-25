"use client";

/**
 * ReportViewer — branded executive forensic-audit report.
 *
 * Distinctly different from the live dashboard:
 *   - A4-style "pages" via ReportPage (agency-logo + red line + client
 *     logo header, red footer accent)
 *   - Narrative hero per page (badge + big title + lead copy)
 *   - Section titles with red square accent
 *   - Stat-card grids, insight callouts, roadmap phases, narrative
 *     tables — all from app/components/report/Primitives.tsx
 *   - Custom SVG charts (ReportFunnel, ReportAgeCpl, ReportCreativeBars)
 *     built for narrative presentation, not interactive exploration
 *
 * The dashboard remains a dense interactive cockpit; this report reads
 * like a deliverable an agency would hand to a client.
 *
 * Four pages, switchable via the top tab nav:
 *   1. Diagnostic        — health + funnel + tracking
 *   2. Creative & Age    — winners/wasters + age CPL
 *   3. 30-Day Roadmap    — phased action plan
 *   4. Geo Audit         — geographic regions + waste
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { X, Printer, ChevronLeft } from "lucide-react";
import type { AuditResult } from "@/engine/runAudit";
import type { ReportBranding } from "@/context/ReportContext";
import ReportPage from "@/components/report/ReportPage";
import {
  ReportHero,
  ReportSecTitle,
  ReportStatCard,
  ReportStatGrid,
  ReportInsightBox,
  ReportTable,
  ReportRoadmapPhase,
  ReportTag,
} from "@/components/report/Primitives";
import ReportFunnel from "@/components/report/ReportFunnel";
import ReportAgeCpl from "@/components/report/ReportAgeCpl";
import ReportCreativeBars from "@/components/report/ReportCreativeBars";

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
  { label: "Diagnostic",     page: 1 },
  { label: "Creative & Age", page: 2 },
  { label: "30-Day Roadmap", page: 3 },
  { label: "Geo Audit",      page: 4 },
];

const fmt$ = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtN = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : Number(n).toLocaleString();
const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${Number(n).toFixed(digits)}%`;

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

  useEffect(() => {
    if (open) setActivePage(page);
  }, [page, open]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    const el = document.getElementById("report-scroll");
    if (el) el.scrollTop = 0;
  }, [activePage]);

  const onPickPage = useCallback((p: number) => setActivePage(p), []);

  // void unused params to keep React happy without firing eslint warnings
  void liveCtr;
  void industry;

  const pageLabel = useMemo(() => `Page ${activePage} / ${PAGE_TABS.length}`, [activePage]);

  if (!open && !visible) return null;

  const commonReportPageProps = {
    agencyLogo: branding.agencyLogo,
    agencyLogoLight: branding.agencyLogoLight,
    clientLogo: branding.clientLogo,
    clientLogoLight: branding.clientLogoLight,
    clientName: audit.clientName,
  };

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
      {/* ── Top nav bar (same chrome as before) ─────────────────────── */}
      <nav
        className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-2 py-2 sm:px-4"
        style={{ background: "var(--header-bg, rgba(6,6,6,0.96))", backdropFilter: "blur(8px)", scrollbarWidth: "none" }}
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

      {/* ── Scrollable content area — one ReportPage per active tab ── */}
      <div id="report-scroll" className="flex-1 overflow-y-auto py-6">
        {activePage === 1 && (
          <ReportPage {...commonReportPageProps} pageLabel={pageLabel}>
            <PageDiagnostic audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        )}
        {activePage === 2 && (
          <ReportPage {...commonReportPageProps} pageLabel={pageLabel}>
            <PageCreativeAge audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        )}
        {activePage === 3 && (
          <ReportPage {...commonReportPageProps} pageLabel={pageLabel}>
            <PageRoadmap audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        )}
        {activePage === 4 && (
          <ReportPage {...commonReportPageProps} pageLabel={pageLabel}>
            <PageGeo audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 1 — DIAGNOSTIC
   ═════════════════════════════════════════════════════════════════════ */
function PageDiagnostic({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const s = audit.spend;
  const t = audit.tracking;
  const cplVsTarget = s.blendedCpl > 0 ? (s.blendedCpl / liveCpl) : 0;
  const cplIsOver = cplVsTarget > 1.1;

  return (
    <>
      <ReportHero
        badge="STRATEGIC FORENSIC AUDIT"
        title="Campaign Infrastructure"
        titleHighlight="Diagnostic"
        lead={`A forensic evaluation of the ${audit.clientName} ad ecosystem. This page reconciles spend, surfaces tracking failures, and locates where paid clicks are being lost before they ever reach the site.`}
      />

      <ReportSecTitle>Efficiency Baselines</ReportSecTitle>
      <ReportStatGrid>
        <ReportStatCard
          label="Reconciled Spend"
          value={fmt$(s.totalSpend)}
          caption={`${s.totalCampaigns} campaigns over ${audit.reportingPeriod.totalDays} days`}
        />
        <ReportStatCard
          label="Verified Leads"
          value={fmtN(s.totalLeads)}
          caption={`Blended CPL ${fmt$(s.blendedCpl)}`}
        />
        <ReportStatCard
          label="Weighted CTR"
          value={fmtPct(s.weightedCtr * 100, 2)}
          caption={`Avg frequency ${s.averageFrequency.toFixed(2)}`}
        />
        <ReportStatCard
          label="Target CPL"
          value={fmt$(liveCpl)}
          accent
          caption={
            cplIsOver
              ? `Currently ${(cplVsTarget * 100).toFixed(0)}% — over budget`
              : `Currently ${(cplVsTarget * 100).toFixed(0)}% — on track`
          }
        />
      </ReportStatGrid>

      <ReportSecTitle>Funnel Leakage</ReportSecTitle>
      <ReportFunnel funnel={audit.funnel} />

      {t.brokenLeadCampaigns > 0 && (
        <ReportInsightBox
          severity="critical"
          title={`Critical Tracking Failure — ${t.brokenLeadCampaigns} of ${t.totalLeadCampaigns} lead campaigns`}
        >
          <strong>{fmt$(t.totalWastedSpend)}</strong> was spent on lead-objective
          campaigns where the engine could not verify a single tracked lead. This
          indicates a misconfigured Instant Form or pixel — tracking repair is the
          #1 priority before any other optimization.
        </ReportInsightBox>
      )}

      {t.failures.length > 0 && (
        <ReportTable
          headers={["Campaign", "Spend", "Issue", "Status"]}
          rows={t.failures.slice(0, 6).map((f) => {
            const r = f as unknown as Record<string, unknown>;
            const name = String(r.campaignName ?? r.name ?? "—");
            const spend = typeof r.spend === "number" ? fmt$(r.spend) : "—";
            const reason = String(r.reason ?? "broken tracking");
            const sev = String(r.severity ?? "critical");
            return [
              <strong key="n">{name}</strong>,
              spend,
              reason,
              <ReportTag key="t" variant={sev === "critical" ? "loss" : "warning"}>
                {sev}
              </ReportTag>,
            ];
          })}
          caption="Top tracking failures by wasted spend. Fix these first to recover attribution data."
        />
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 2 — CREATIVE & AGE
   ═════════════════════════════════════════════════════════════════════ */
function PageCreativeAge({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const c = audit.creative;
  return (
    <>
      <ReportHero
        badge="CREATIVE & AUDIENCE INSIGHT"
        title="Where the Money Is"
        titleHighlight="Working"
        lead="Which ads convert at the lowest cost per lead, which ones drain budget without returning leads, and which audience age brackets actually generate revenue."
      />

      <ReportSecTitle>Creative Heatmap — Winners vs Wasters</ReportSecTitle>
      <ReportCreativeBars creative={c} max={5} />

      {c.fatigueWarning && (
        <ReportInsightBox severity="warning" title="Creative Fatigue Signal">
          {c.fatigueWarning} — {c.frequencyFatigueCount} ad
          {c.frequencyFatigueCount === 1 ? "" : "s"} crossed the frequency
          threshold where engagement typically degrades.
        </ReportInsightBox>
      )}

      <ReportSecTitle>Cost Per Lead by Age Bracket</ReportSecTitle>
      <ReportAgeCpl demographics={audit.demographics} targetCpl={liveCpl} />

      {audit.demographics.genderRecommendation && (
        <ReportInsightBox severity="info" title="Gender Targeting">
          {audit.demographics.genderRecommendation}
        </ReportInsightBox>
      )}

      {audit.placements.placements.length > 0 && (
        <>
          <ReportSecTitle>Placement Efficiency</ReportSecTitle>
          <ReportTable
            headers={["Placement", "Spend", "Leads", "CPL", "Status"]}
            rows={audit.placements.placements.slice(0, 8).map((p) => {
              const r = p as unknown as Record<string, unknown>;
              const name = String(r.name ?? r.placement ?? "—");
              const spend = typeof r.spend === "number" ? r.spend : 0;
              const leads = typeof r.leads === "number" ? r.leads : (typeof r.conversions === "number" ? r.conversions : 0);
              const cpl = typeof r.cpl === "number" ? r.cpl : 0;
              const status =
                cpl === 0
                  ? <ReportTag variant="neutral">no leads</ReportTag>
                  : cpl > liveCpl * 1.2
                    ? <ReportTag variant="loss">over target</ReportTag>
                    : cpl < liveCpl * 0.85
                      ? <ReportTag variant="win">winning</ReportTag>
                      : <ReportTag variant="warning">borderline</ReportTag>;
              return [
                <strong key="n">{name}</strong>,
                fmt$(spend),
                fmtN(leads),
                fmt$(cpl),
                status,
              ];
            })}
            caption={audit.placements.recommendation}
          />
        </>
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 3 — 30-DAY ROADMAP
   ═════════════════════════════════════════════════════════════════════ */
function PageRoadmap({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const s = audit.spend;
  const t = audit.tracking;
  const g = audit.geo;
  const c = audit.creative;

  // Recoverable spend estimate from the engine's own components.
  const recoverable =
    (t.totalWastedSpend ?? 0) +
    (g.wasteUSD ?? 0) +
    (audit.placements.totalWaste ?? 0) +
    c.wasters.reduce((sum, ad) => sum + (ad.spend ?? 0), 0);

  return (
    <>
      <ReportHero
        badge="ACTION PLAN"
        title="30-Day"
        titleHighlight="Recovery Roadmap"
        lead={`Phased execution plan to recover ${fmt$(recoverable)} in wasted spend and bring blended CPL toward the ${fmt$(liveCpl)} target. Sequence matters — tracking repair before optimization, otherwise you optimize against bad data.`}
      />

      <ReportStatGrid>
        <ReportStatCard
          label="Recoverable Spend"
          value={fmt$(recoverable)}
          accent
          caption="Sum of tracking, geographic, placement, and creative waste"
        />
        <ReportStatCard
          label="Current Blended CPL"
          value={fmt$(s.blendedCpl)}
          caption={`Target ${fmt$(liveCpl)}`}
        />
        <ReportStatCard
          label="Wasters to Pause"
          value={fmtN(c.wasters.length)}
          caption={`${fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} freed up`}
        />
      </ReportStatGrid>

      <ReportSecTitle>Phased Execution</ReportSecTitle>

      <ReportRoadmapPhase
        index={1}
        title="Week 1 — Stop the Bleeding"
        duration="Days 1–7"
        items={[
          <><strong>Pause {c.wasters.length} waster ad{c.wasters.length === 1 ? "" : "s"}</strong> immediately — they are spending {fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} with little to no lead return.</>,
          t.brokenLeadCampaigns > 0
            ? <><strong>Fix tracking</strong> on {t.brokenLeadCampaigns} broken lead campaign{t.brokenLeadCampaigns === 1 ? "" : "s"} — verify pixel + Instant Form, test a real lead submission, confirm event fires in CRM.</>
            : <><strong>Audit tracking pixel</strong> — confirm Lead event still fires on form submission and reaches the CRM API.</>,
          <>Export and archive the current 30-day baseline so post-fix performance is comparable.</>,
        ]}
      />

      <ReportRoadmapPhase
        index={2}
        title="Week 2 — Reallocate Budget"
        duration="Days 8–14"
        items={[
          c.winners.length > 0
            ? <><strong>Scale the {c.winners.length} winner ad{c.winners.length === 1 ? "" : "s"}</strong> with the freed budget — start at +50% spend and watch CPL daily for 3 days.</>
            : <>No clear lead-CPL winners yet — launch 2 new creative variants of your best-converting placement.</>,
          g.wasteUSD > 0
            ? <><strong>Hard-cap geo delivery</strong> on the regions burning {fmt$(g.wasteUSD)} with low conversion. Tighten the location radius to your actual service area.</>
            : <>Geographic delivery is within tolerance — no geo changes needed this week.</>,
          <>Move at least 25% of placement spend out of any &ldquo;over target&rdquo; placements (from the placement table) into &ldquo;winning&rdquo; ones.</>,
        ]}
      />

      <ReportRoadmapPhase
        index={3}
        title="Week 3 — Optimize Conversion"
        duration="Days 15–21"
        items={[
          <>A/B test the landing page — current click-to-session loss is <strong>{fmtPct(audit.funnel.clickToSessionLossPct)}</strong>. Even a 10-point improvement here recovers significant spend.</>,
          <>Refresh top-performer creative — frequency caps prevent burnout, but rotate hooks every 2 weeks for safety.</>,
          <>Tighten audience age targeting toward the brackets that convert under target CPL (see Creative &amp; Age page).</>,
        ]}
      />

      <ReportRoadmapPhase
        index={4}
        title="Week 4 — Compound &amp; Document"
        duration="Days 22–30"
        items={[
          <>Run a follow-up audit and compare against the Week-1 baseline export. Document the {fmt$(recoverable)} reclaim with screenshots.</>,
          <>Lock in winning campaigns at higher daily budgets — graduate from testing into scaled-spend mode.</>,
          <>Establish a weekly review cadence on the dashboard so the next round of waste is caught in days, not weeks.</>,
        ]}
      />
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 4 — GEO AUDIT
   ═════════════════════════════════════════════════════════════════════ */
function PageGeo({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const g = audit.geo;
  const regions = [...g.regions].sort((a, b) => b.spend - a.spend);
  return (
    <>
      <ReportHero
        badge="GEOGRAPHIC DELIVERY"
        title="Where Spend Is"
        titleHighlight="Actually Converting"
        lead={`Region-by-region breakdown of paid delivery. Hot zones converted at or below target CPL; cold zones drained budget with little return. ${g.recommendation}`}
      />

      <ReportStatGrid>
        <ReportStatCard
          label="Core Hot-Zone Spend"
          value={fmt$(g.coreHotSpend)}
          caption="Spend in regions performing at or near target"
        />
        <ReportStatCard
          label="Estimated Waste"
          value={fmt$(g.wasteUSD)}
          accent
          caption="Spend in low-converting zones outside your service core"
        />
        <ReportStatCard
          label="Regions Mapped"
          value={fmtN(g.zonesMapped)}
          caption="Distinct DMAs surfaced in the breakdown export"
        />
      </ReportStatGrid>

      <ReportSecTitle>Region Performance</ReportSecTitle>
      <ReportTable
        headers={["Region", "Spend", "Share", "Conversions", "CPL", "Status"]}
        rows={regions.slice(0, 12).map((r) => {
          const cplVsTarget = r.cpl > 0 ? r.cpl / liveCpl : 0;
          const status =
            r.conversions === 0
              ? <ReportTag variant="loss">zero return</ReportTag>
              : cplVsTarget > 1.5
                ? <ReportTag variant="loss">over target</ReportTag>
                : cplVsTarget > 1.1
                  ? <ReportTag variant="warning">borderline</ReportTag>
                  : <ReportTag variant="win">on target</ReportTag>;
          return [
            <strong key="n">{r.name}</strong>,
            fmt$(r.spend),
            fmtPct(r.share * 100, 1),
            fmtN(r.conversions),
            r.cpl > 0 ? fmt$(r.cpl) : "—",
            status,
          ];
        })}
        caption={`Ranked by spend. ${regions.filter((r) => r.conversions === 0).length} region${regions.filter((r) => r.conversions === 0).length === 1 ? "" : "s"} returned zero leads — likely candidates for geo-cap.`}
      />

      {g.wasteUSD > 0 && (
        <ReportInsightBox severity="warning" title="Recommended Action">
          Hard-cap delivery on the zero-return regions above. Reallocate the
          freed <strong>{fmt$(g.wasteUSD)}</strong> into your top-3 hot-zones to compound
          on what&rsquo;s already converting.
        </ReportInsightBox>
      )}
    </>
  );
}
