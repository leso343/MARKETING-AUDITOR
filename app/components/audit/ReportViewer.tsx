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

import { useEffect, useState, useCallback, useRef } from "react";
import { X, Printer, ChevronLeft } from "lucide-react";
import type { AuditResult } from "@/engine/runAudit";
import type { ReportBranding } from "@/context/ReportContext";
import { useLang } from "@/context/LangContext";
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

/**
 * Page tab labels — computed inside the component so the language
 * toggle flips them. Page numbers are stable (used for anchor IDs).
 */
function usePageTabs() {
  const { t } = useLang();
  return [
    { label: t("Diagnostic", "What We Found"),       page: 1 },
    { label: t("Creative & Age", "Ads & Audiences"), page: 2 },
    { label: t("30-Day Roadmap", "Action Plan"),     page: 3 },
    { label: t("Geo Audit", "Where Your Money Went"), page: 4 },
  ];
}

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
  const { t } = useLang();
  const PAGE_TABS = usePageTabs();
  const [visible, setVisible] = useState(false);
  // activePage drives which tab is highlighted — content always renders all 4
  const [activePage, setActivePage] = useState(page);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  /**
   * Smooth-scroll to a page section by anchor id. Uses scrollTo with an
   * offset so the sticky top nav doesn't cover the page header.
   */
  const onPickPage = useCallback((p: number) => {
    setActivePage(p); // optimistic — observer will reconfirm
    const target = document.getElementById(`report-page-${p}`);
    const container = scrollRef.current;
    if (!target || !container) return;
    const top = target.offsetTop - 12;
    container.scrollTo({ top, behavior: "smooth" });
  }, []);

  /**
   * Initial-page jump when the viewer first opens. Wait for the
   * fade-in to complete so anchor offsets are correct.
   */
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const target = document.getElementById(`report-page-${page}`);
      const container = scrollRef.current;
      if (target && container) {
        container.scrollTo({ top: target.offsetTop - 12, behavior: "auto" });
      }
      setActivePage(page);
    }, 360); // matches the fade-in transition
    return () => clearTimeout(id);
  }, [open, page]);

  /**
   * IntersectionObserver tracks which page is mostly in view and
   * updates the active tab highlight accordingly.
   */
  useEffect(() => {
    if (!open) return;
    const container = scrollRef.current;
    if (!container) return;
    const sections = PAGE_TABS.map((tab) =>
      document.getElementById(`report-page-${tab.page}`),
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Sort by intersectionRatio desc; first one is the most visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top) return;
        const idStr = top.target.id.replace("report-page-", "");
        const n = Number(idStr);
        if (Number.isFinite(n) && n !== activePage) setActivePage(n);
      },
      {
        root: container,
        // Top trigger band — page is "active" when its top crosses ~25%
        // of the viewport. Bottom margin negative so transitions feel snappy.
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0, 0.1, 0.3, 0.5, 0.75, 1],
      },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // void unused params to keep React happy without firing eslint warnings
  void liveCtr;
  void industry;

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
          <span className="hidden sm:inline">{t("Back to dashboard", "Back to dashboard")}</span>
          <span className="sm:hidden">{t("Back", "Back")}</span>
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
            title={t("Print or download report", "Print or download report")}
          >
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">{t("Print", "Download")}</span>
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

      {/* ── Scrollable content area — ALL 4 pages stacked, tab clicks
              just smooth-scroll to the right anchor. ──────────────── */}
      <div ref={scrollRef} id="report-scroll" className="flex-1 overflow-y-auto py-6">
        <div id="report-page-1" style={{ scrollMarginTop: 12 }}>
          <ReportPage {...commonReportPageProps} pageLabel={t("Page 1 / 4", "Page 1 of 4")}>
            <PageDiagnostic audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        </div>
        <div id="report-page-2" style={{ scrollMarginTop: 12 }}>
          <ReportPage {...commonReportPageProps} pageLabel={t("Page 2 / 4", "Page 2 of 4")}>
            <PageCreativeAge audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        </div>
        <div id="report-page-3" style={{ scrollMarginTop: 12 }}>
          <ReportPage {...commonReportPageProps} pageLabel={t("Page 3 / 4", "Page 3 of 4")}>
            <PageRoadmap audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        </div>
        <div id="report-page-4" style={{ scrollMarginTop: 12 }}>
          <ReportPage {...commonReportPageProps} pageLabel={t("Page 4 / 4", "Page 4 of 4")}>
            <PageGeo audit={audit} liveCpl={liveCpl} />
          </ReportPage>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 1 — DIAGNOSTIC
   ═════════════════════════════════════════════════════════════════════ */
function PageDiagnostic({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const { t, plain } = useLang();
  const s = audit.spend;
  const tr = audit.tracking;
  const cplVsTarget = s.blendedCpl > 0 ? (s.blendedCpl / liveCpl) : 0;
  const cplIsOver = cplVsTarget > 1.1;

  return (
    <>
      <ReportHero
        badge={t("STRATEGIC FORENSIC AUDIT", "AD ACCOUNT REVIEW")}
        title={t("Campaign Infrastructure", "Account")}
        titleHighlight={t("Diagnostic", "Health Check")}
        lead={t(
          `A forensic evaluation of the ${audit.clientName} ad ecosystem. This page reconciles spend, surfaces tracking failures, and locates where paid clicks are being lost before they ever reach the site.`,
          `A close look at how ${audit.clientName}'s ad account is doing. This page checks the spend totals, flags tracking problems, and shows where paid clicks are getting lost before they reach the site.`,
        )}
      />

      <ReportSecTitle>{t("Efficiency Baselines", "The Numbers At A Glance")}</ReportSecTitle>
      <ReportStatGrid>
        <ReportStatCard
          label={t("Reconciled Spend", "Total Ad Spend")}
          value={fmt$(s.totalSpend)}
          caption={t(
            `${s.totalCampaigns} campaigns over ${audit.reportingPeriod.totalDays} days`,
            `${s.totalCampaigns} campaigns over ${audit.reportingPeriod.totalDays} days`,
          )}
        />
        <ReportStatCard
          label={t("Verified Leads", "Leads Captured")}
          value={fmtN(s.totalLeads)}
          caption={t(`Blended CPL ${fmt$(s.blendedCpl)}`, `Average cost per lead: ${fmt$(s.blendedCpl)}`)}
        />
        <ReportStatCard
          label={t("Weighted CTR", "Click Rate")}
          value={fmtPct(s.weightedCtr * 100, 2)}
          caption={t(
            `Avg frequency ${s.averageFrequency.toFixed(2)}`,
            `Same person saw your ad ${s.averageFrequency.toFixed(2)}× on average`,
          )}
        />
        <ReportStatCard
          label={t("Target CPL", "Lead Cost Goal")}
          value={fmt$(liveCpl)}
          accent
          caption={
            cplIsOver
              ? t(
                  `Currently ${(cplVsTarget * 100).toFixed(0)}% — over budget`,
                  `Currently at ${(cplVsTarget * 100).toFixed(0)}% — over budget`,
                )
              : t(
                  `Currently ${(cplVsTarget * 100).toFixed(0)}% — on track`,
                  `Currently at ${(cplVsTarget * 100).toFixed(0)}% — on track`,
                )
          }
        />
      </ReportStatGrid>

      <ReportSecTitle>{t("Funnel Leakage", "Where People Drop Off")}</ReportSecTitle>
      <ReportFunnel funnel={audit.funnel} />

      {tr.brokenLeadCampaigns > 0 && (
        <ReportInsightBox
          severity="critical"
          title={t(
            `Critical Tracking Failure — ${tr.brokenLeadCampaigns} of ${tr.totalLeadCampaigns} lead campaigns`,
            `Tracking Broken — ${tr.brokenLeadCampaigns} of ${tr.totalLeadCampaigns} lead campaigns`,
          )}
        >
          {plain ? (
            <>
              <strong>{fmt$(tr.totalWastedSpend)}</strong> was spent on campaigns
              built to get leads, but Meta couldn&apos;t see a single lead come in. This
              usually means a form or tracking pixel is set up wrong — fixing this
              comes first, before any other changes.
            </>
          ) : (
            <>
              <strong>{fmt$(tr.totalWastedSpend)}</strong> was spent on lead-objective
              campaigns where the engine could not verify a single tracked lead. This
              indicates a misconfigured Instant Form or pixel — tracking repair is the
              #1 priority before any other optimisation.
            </>
          )}
        </ReportInsightBox>
      )}

      {tr.failures.length > 0 && (
        <ReportTable
          headers={
            plain
              ? ["Affected campaign(s)", "Money wasted", "What's wrong", "How bad"]
              : ["Affected campaign(s)", "Wasted spend", "Issue", "Severity"]
          }
          rows={tr.failures.slice(0, 6).map((f) => {
            const campaigns = f.affectedCampaigns ?? [];
            const displayName =
              campaigns.length === 0
                ? "—"
                : campaigns.length === 1
                  ? campaigns[0]
                  : `${campaigns[0]} (+${campaigns.length - 1} more)`;
            const sev = (f.severity ?? "warn").toLowerCase();
            const variant: "loss" | "warning" | "neutral" =
              sev === "critical" || sev === "high" ? "loss"
              : sev === "warn" || sev === "med" || sev === "medium" ? "warning"
              : "neutral";
            return [
              <strong key="n">{displayName}</strong>,
              fmt$(f.estimatedImpact),
              f.description,
              <ReportTag key="t" variant={variant}>
                {f.severity}
              </ReportTag>,
            ];
          })}
          caption={t(
            "Top tracking failures by wasted spend. Fix these first to recover attribution data.",
            "The tracking problems wasting the most money. Fix these first to get accurate data again.",
          )}
        />
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   PAGE 2 — CREATIVE & AGE
   ═════════════════════════════════════════════════════════════════════ */
function PageCreativeAge({ audit, liveCpl }: { audit: AuditResult; liveCpl: number }) {
  const { t, plain } = useLang();
  const c = audit.creative;
  return (
    <>
      <ReportHero
        badge={t("CREATIVE & AUDIENCE INSIGHT", "ADS & AUDIENCES")}
        title={t("Where the Money Is", "Where Your Ad Money Is")}
        titleHighlight={t("Working", "Working")}
        lead={t(
          "Which ads convert at the lowest cost per lead, which ones drain budget without returning leads, and which audience age brackets actually generate revenue.",
          "Which of your ads get leads for the lowest cost, which ones spend money without bringing in leads, and which age groups actually become customers.",
        )}
      />

      <ReportSecTitle>{t("Creative Performance — Winners vs Wasters", "Best & Worst Performing Ads")}</ReportSecTitle>
      <ReportCreativeBars creative={c} max={5} />

      {c.fatigueWarning && (
        <ReportInsightBox
          severity="warning"
          title={t("Creative Fatigue Signal", "Ads Are Getting Stale")}
        >
          {c.fatigueWarning} — {c.frequencyFatigueCount}{" "}
          {plain
            ? `ad${c.frequencyFatigueCount === 1 ? "" : "s"} are being shown to the same people too often, and people usually stop responding when that happens.`
            : `ad${c.frequencyFatigueCount === 1 ? "" : "s"} crossed the frequency threshold where engagement typically degrades.`}
        </ReportInsightBox>
      )}

      <ReportSecTitle>{t("Cost Per Lead by Age Bracket", "Lead Cost by Age Group")}</ReportSecTitle>
      <ReportAgeCpl demographics={audit.demographics} targetCpl={liveCpl} />

      {audit.demographics.genderRecommendation && (
        <ReportInsightBox
          severity="info"
          title={t("Gender Targeting", "Who To Show Ads To")}
        >
          {audit.demographics.genderRecommendation}
        </ReportInsightBox>
      )}

      {audit.placements.placements.length > 0 && (
        <>
          <ReportSecTitle>{t("Placement Efficiency", "Where Your Ads Are Shown")}</ReportSecTitle>
          <ReportTable
            headers={
              plain
                ? ["Where shown", "Spent", "Leads", "Cost/Lead", "Status"]
                : ["Placement", "Spend", "Leads", "CPL", "Status"]
            }
            rows={audit.placements.placements.slice(0, 8).map((p) => {
              const r = p as unknown as Record<string, unknown>;
              const name = String(r.name ?? r.placement ?? "—");
              const spend = typeof r.spend === "number" ? r.spend : 0;
              const leads = typeof r.leads === "number" ? r.leads : (typeof r.conversions === "number" ? r.conversions : 0);
              const cpl = typeof r.cpl === "number" ? r.cpl : 0;
              const status =
                cpl === 0
                  ? <ReportTag variant="neutral">{t("no leads", "no leads")}</ReportTag>
                  : cpl > liveCpl * 1.2
                    ? <ReportTag variant="loss">{t("over target", "too expensive")}</ReportTag>
                    : cpl < liveCpl * 0.85
                      ? <ReportTag variant="win">{t("winning", "great")}</ReportTag>
                      : <ReportTag variant="warning">{t("borderline", "okay")}</ReportTag>;
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
  const { t, plain } = useLang();
  const s = audit.spend;
  const tr = audit.tracking;
  const g = audit.geo;
  const c = audit.creative;

  // Recoverable spend estimate from the engine's own components.
  const recoverable =
    (tr.totalWastedSpend ?? 0) +
    (g.wasteUSD ?? 0) +
    (audit.placements.totalWaste ?? 0) +
    c.wasters.reduce((sum, ad) => sum + (ad.spend ?? 0), 0);

  return (
    <>
      <ReportHero
        badge={t("ACTION PLAN", "WHAT TO DO NEXT")}
        title={t("30-Day", "30-Day")}
        titleHighlight={t("Recovery Roadmap", "Action Plan")}
        lead={t(
          `Phased execution plan to recover ${fmt$(recoverable)} in wasted spend and bring blended CPL toward the ${fmt$(liveCpl)} target. Sequence matters — tracking repair before optimisation, otherwise you optimise against bad data.`,
          `A week-by-week plan to win back ${fmt$(recoverable)} in wasted spend and get your average lead cost closer to ${fmt$(liveCpl)}. The order matters — fix tracking first, because everything else relies on accurate data.`,
        )}
      />

      <ReportStatGrid>
        <ReportStatCard
          label={t("Recoverable Spend", "Money You Can Win Back")}
          value={fmt$(recoverable)}
          accent
          caption={t(
            "Sum of tracking, geographic, placement, and creative waste",
            "Total of tracking, location, placement, and ad waste combined",
          )}
        />
        <ReportStatCard
          label={t("Current Blended CPL", "Current Cost Per Lead")}
          value={fmt$(s.blendedCpl)}
          caption={t(`Target ${fmt$(liveCpl)}`, `Goal: ${fmt$(liveCpl)}`)}
        />
        <ReportStatCard
          label={t("Wasters to Pause", "Ads To Pause")}
          value={fmtN(c.wasters.length)}
          caption={t(
            `${fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} freed up`,
            `${fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} freed up for better ads`,
          )}
        />
      </ReportStatGrid>

      <ReportSecTitle>{t("Phased Execution", "Week-By-Week Plan")}</ReportSecTitle>

      <ReportRoadmapPhase
        index={1}
        title={t("Week 1 — Stop the Losses", "Week 1 — Stop The Losses")}
        duration={t("Days 1–7", "Days 1–7")}
        items={plain ? [
          <><strong>Pause {c.wasters.length} ad{c.wasters.length === 1 ? "" : "s"}</strong> that aren&apos;t working — they&apos;ve spent {fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} with few or no leads.</>,
          tr.brokenLeadCampaigns > 0
            ? <><strong>Fix tracking</strong> on {tr.brokenLeadCampaigns} broken lead campaign{tr.brokenLeadCampaigns === 1 ? "" : "s"} — check the form and pixel, submit a test lead yourself, and make sure it shows up in your CRM.</>
            : <><strong>Double-check tracking</strong> — submit a test lead through your form and confirm it lands in your CRM.</>,
          <>Save your current 30-day numbers so you can compare progress after the fixes.</>,
        ] : [
          <><strong>Pause {c.wasters.length} non-performing ad{c.wasters.length === 1 ? "" : "s"}</strong> immediately — they are spending {fmt$(c.wasters.reduce((a, b) => a + b.spend, 0))} with little to no lead return.</>,
          tr.brokenLeadCampaigns > 0
            ? <><strong>Fix tracking</strong> on {tr.brokenLeadCampaigns} broken lead campaign{tr.brokenLeadCampaigns === 1 ? "" : "s"} — verify pixel + Instant Form, test a real lead submission, confirm event fires in CRM.</>
            : <><strong>Audit tracking pixel</strong> — confirm the Lead event still fires on form submission and reaches the CRM API.</>,
          <>Export and archive the current 30-day baseline so post-fix performance is comparable.</>,
        ]}
      />

      <ReportRoadmapPhase
        index={2}
        title={t("Week 2 — Reallocate Budget", "Week 2 — Move Money To What Works")}
        duration={t("Days 8–14", "Days 8–14")}
        items={plain ? [
          c.winners.length > 0
            ? <><strong>Spend more on the {c.winners.length} best ad{c.winners.length === 1 ? "" : "s"}</strong> using the freed-up money — start with 50% more budget and watch the lead cost daily for 3 days.</>
            : <>No standout winning ads yet — launch 2 fresh versions of your best-performing ad to test.</>,
          g.wasteUSD > 0
            ? <><strong>Stop running ads</strong> in the areas wasting {fmt$(g.wasteUSD)} with few leads. Tighten your targeting to the areas where you actually do business.</>
            : <>Your location targeting is fine — no changes needed this week.</>,
          <>Move at least 25% of money away from any &quot;too expensive&quot; placements (from the placement table) and into the &quot;great&quot; ones.</>,
        ] : [
          c.winners.length > 0
            ? <><strong>Scale the {c.winners.length} top-performing ad{c.winners.length === 1 ? "" : "s"}</strong> with the freed budget — start at +50% spend and watch CPL daily for 3 days.</>
            : <>No clear lead-CPL winners yet — launch 2 new creative variants of your best-converting placement.</>,
          g.wasteUSD > 0
            ? <><strong>Hard-cap geo delivery</strong> on the regions accumulating {fmt$(g.wasteUSD)} with low conversion. Tighten the location radius to your actual service area.</>
            : <>Geographic delivery is within tolerance — no geo changes needed this week.</>,
          <>Move at least 25% of placement spend out of any &ldquo;over target&rdquo; placements (from the placement table) into &ldquo;winning&rdquo; ones.</>,
        ]}
      />

      <ReportRoadmapPhase
        index={3}
        title={t("Week 3 — Optimise Conversion", "Week 3 — Improve The Landing Page")}
        duration={t("Days 15–21", "Days 15–21")}
        items={plain ? [
          <>Test two versions of your landing page — right now <strong>{fmtPct(audit.funnel.clickToSessionLossPct)}</strong> of clicks never reach your site. Even a small improvement saves significant money.</>,
          <>Refresh your best ads — even great ads stop working when people see them too often. Switch up the hook every 2 weeks.</>,
          <>Focus your age targeting on the groups that bring in the cheapest leads (see the Ads &amp; Audiences page).</>,
        ] : [
          <>A/B test the landing page — current click-to-session loss is <strong>{fmtPct(audit.funnel.clickToSessionLossPct)}</strong>. Even a 10-point improvement here recovers significant spend.</>,
          <>Refresh top-performer creative — frequency caps prevent burnout, but rotate hooks every 2 weeks for safety.</>,
          <>Tighten audience age targeting toward the brackets that convert under target CPL (see Creative &amp; Age page).</>,
        ]}
      />

      <ReportRoadmapPhase
        index={4}
        title={t("Week 4 — Compound & Document", "Week 4 — Lock In The Wins")}
        duration={t("Days 22–30", "Days 22–30")}
        items={plain ? [
          <>Run a fresh audit and compare it to the Week 1 snapshot. Take screenshots showing the {fmt$(recoverable)} you won back.</>,
          <>Increase the daily budget on the campaigns that are now working — graduate them from testing into full scale.</>,
          <>Set up a weekly review on the dashboard so the next round of waste is caught in days, not weeks.</>,
        ] : [
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
  const { t, plain } = useLang();
  const g = audit.geo;
  const regions = [...g.regions].sort((a, b) => b.spend - a.spend);
  const zeroReturnCount = regions.filter((r) => r.conversions === 0).length;
  return (
    <>
      <ReportHero
        badge={t("GEOGRAPHIC DELIVERY", "WHERE YOUR MONEY WENT")}
        title={t("Where Spend Is", "Where Your Ad Spend Is")}
        titleHighlight={t("Actually Converting", "Actually Working")}
        lead={t(
          `Region-by-region breakdown of paid delivery. Hot zones converted at or below target CPL; cold zones drained budget with little return. ${g.recommendation}`,
          `A look at every area your ads ran in. Strong areas brought leads at or under your goal cost; weak areas spent money with little to show. ${g.recommendation}`,
        )}
      />

      <ReportStatGrid>
        <ReportStatCard
          label={t("Core Hot-Zone Spend", "Spend In Strong Areas")}
          value={fmt$(g.coreHotSpend)}
          caption={t(
            "Spend in regions performing at or near target",
            "Money spent in areas hitting your goal cost",
          )}
        />
        <ReportStatCard
          label={t("Estimated Waste", "Money Spent In Weak Areas")}
          value={fmt$(g.wasteUSD)}
          accent
          caption={t(
            "Spend in low-converting zones outside your service core",
            "Money spent where almost no one became a lead",
          )}
        />
        <ReportStatCard
          label={t("Regions Mapped", "Areas Covered")}
          value={fmtN(g.zonesMapped)}
          caption={t(
            "Distinct DMAs surfaced in the breakdown export",
            "Different regions your ads reached",
          )}
        />
      </ReportStatGrid>

      <ReportSecTitle>{t("Region Performance", "How Each Area Did")}</ReportSecTitle>
      <ReportTable
        headers={
          plain
            ? ["Area", "Spent", "Share", "Leads", "Cost/Lead", "Status"]
            : ["Region", "Spend", "Share", "Conversions", "CPL", "Status"]
        }
        rows={regions.slice(0, 12).map((r) => {
          const cplVsTarget = r.cpl > 0 ? r.cpl / liveCpl : 0;
          const status =
            r.conversions === 0
              ? <ReportTag variant="loss">{t("zero return", "no leads")}</ReportTag>
              : cplVsTarget > 1.5
                ? <ReportTag variant="loss">{t("over target", "too expensive")}</ReportTag>
                : cplVsTarget > 1.1
                  ? <ReportTag variant="warning">{t("borderline", "okay")}</ReportTag>
                  : <ReportTag variant="win">{t("on target", "great")}</ReportTag>;
          return [
            <strong key="n">{r.name}</strong>,
            fmt$(r.spend),
            fmtPct(r.share * 100, 1),
            fmtN(r.conversions),
            r.cpl > 0 ? fmt$(r.cpl) : "—",
            status,
          ];
        })}
        caption={t(
          `Ranked by spend. ${zeroReturnCount} region${zeroReturnCount === 1 ? "" : "s"} returned zero leads — likely candidates for geo-cap.`,
          `Sorted by how much you spent. ${zeroReturnCount} area${zeroReturnCount === 1 ? "" : "s"} brought in zero leads — strong candidates to stop running ads in.`,
        )}
      />

      {g.wasteUSD > 0 && (
        <ReportInsightBox
          severity="warning"
          title={t("Recommended Action", "What To Do")}
        >
          {plain ? (
            <>
              Stop running ads in the no-lead areas above. Put that{" "}
              <strong>{fmt$(g.wasteUSD)}</strong> into your top 3 strongest areas
              instead — double down on what&rsquo;s already working.
            </>
          ) : (
            <>
              Hard-cap delivery on the zero-return regions above. Reallocate the
              freed <strong>{fmt$(g.wasteUSD)}</strong> into your top-3 hot-zones to
              compound on what&rsquo;s already converting.
            </>
          )}
        </ReportInsightBox>
      )}
    </>
  );
}
