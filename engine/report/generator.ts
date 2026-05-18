/**
 * Report generator.
 *
 * Reads /engine/report/template.html, substitutes {{TOKEN}} and __TOKEN__
 * placeholders with values from the analysis context, and writes the result to
 * an absolute output path. The substitution is intentionally minimal — no
 * templating library, no expressions, just literal replacement.
 */
import * as fs from 'fs';
import * as path from 'path';
import { FunnelLeakageResult, FunnelStage } from '../analyses/funnelLeakage';
import { TrackingFailuresResult } from '../analyses/trackingFailures';
import { GeographicWasteResult, RegionStat } from '../analyses/geographicWaste';
import { CreativeAnalysisResult } from '../analyses/creativeAnalysis';
import { SpendEfficiencyResult } from '../analyses/spendEfficiency';
import { DemographicsResult } from '../analyses/demographics';
import { KpiCard, StatusLevel } from '../types';

export interface ReportInput {
  clientName: string;
  funnel: FunnelLeakageResult;
  tracking: TrackingFailuresResult;
  geo: GeographicWasteResult;
  creative: CreativeAnalysisResult;
  spend: SpendEfficiencyResult;
  demographics: DemographicsResult;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  ok: '#4ade80',
  warn: '#facc15',
  critical: '#ff0000',
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compactUsd(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Minimal substituter. Replaces every key — case-sensitive, literal. */
function substitute(template: string, context: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(context)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}|__${k}__`, 'g');
    out = out.replace(re, v);
  }
  return out;
}

// ---------- block renderers ----------

function renderKpiCards(kpis: KpiCard[]): string {
  return kpis
    .map((k) => {
      const color = k.status === 'critical' ? ' style="color: var(--red);"' : k.status === 'warn' ? ' style="color: #facc15;"' : '';
      return `
                <div class="panel">
                    <div class="panel-label">${escapeHtml(k.label)}</div>
                    <div class="stat-group">
                        <div class="stat-val"${color}>${escapeHtml(k.value)}</div>
                        <div class="stat-desc">${escapeHtml(k.unit)}</div>
                        <div class="stat-desc" style="margin-top:6px; color:#3a3a3a; font-size:9px;">${escapeHtml(k.benchmark)}</div>
                    </div>
                </div>`;
    })
    .join('\n');
}

function renderFunnelStages(stages: FunnelStage[]): string {
  if (!stages.length) return '';
  const top = stages[0].count || 1;
  return stages
    .map((s, i) => {
      const widthPct = i === 0 ? 100 : Math.max(2, Math.min(100, (s.count / top) * 100));
      const critical = s.status === 'critical';
      const borderStyle = critical ? ' style="border-color: var(--red-dim);"' : '';
      const fillStyle = critical ? 'background: var(--red);' : '';
      const labelStyle = critical ? ' style="color: var(--red);"' : '';
      return `<div class="funnel-stage"${borderStyle}>
                    <div class="funnel-fill" style="width: ${widthPct.toFixed(1)}%; ${fillStyle}"></div>
                    <div class="funnel-content">
                        <span class="stage-label"${labelStyle}>${escapeHtml(s.name)}</span>
                        <span class="stage-val">${s.count.toLocaleString('en-US')}</span>
                    </div>
                </div>`;
    })
    .join('\n                ');
}

function renderDemoTable(d: DemographicsResult): string {
  const rows = d.brackets.filter((b) => b.spend > 0);
  if (!rows.length) {
    return '<tr><td colspan="4" style="color:#444; text-align:center; padding:20px;">No age/gender breakdown CSV provided.</td></tr>';
  }
  return rows
    .map((b) => {
      const pillColor = b.status === 'critical' ? 'var(--red)' : b.status === 'warn' ? '#facc15' : '#4ade80';
      return `<tr><td>${escapeHtml(b.bracket)}</td><td>$${fmtUsd(b.spend)}</td><td>${b.cpl > 0 ? '$' + b.cpl.toFixed(2) : '—'}</td><td><span class="status-pill" style="color: ${pillColor};">${b.outcome}</span></td></tr>`;
    })
    .join('\n                        ');
}

interface GeoZoneJs {
  zip: string;
  name: string;
  x: number;
  y: number;
  spend: number;
  leads: number;
  cpl: number;
  status: 'hot' | 'mixed' | 'cold' | 'leak';
}

/** Place regions onto a 600x320 SVG canvas using polar coordinates seeded by name hash. */
function layoutGeoZones(regions: RegionStat[]): GeoZoneJs[] {
  const center = { x: 300, y: 180 };
  const inService = regions.filter((r) => r.status !== 'leak');
  const leaks = regions.filter((r) => r.status === 'leak');

  function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  const zones: GeoZoneJs[] = [];
  inService.forEach((r, i) => {
    const h = hash(r.name + i);
    // Distribute around a 100px radius circle with deterministic jitter.
    const angle = ((i / Math.max(1, inService.length)) * Math.PI * 2) + (h % 60) / 60 - 0.5;
    const radius = 50 + (h % 70);
    const x = Math.round(center.x + Math.cos(angle) * radius);
    const y = Math.round(center.y + Math.sin(angle) * radius);
    zones.push({
      zip: short(r.name),
      name: r.name,
      x,
      y,
      spend: r.spend,
      leads: r.conversions,
      cpl: r.cpl,
      status: r.status,
    });
  });
  leaks.forEach((r, i) => {
    // Leaks go to the corners.
    const corners = [
      { x: 520, y: 52 },
      { x: 78, y: 58 },
      { x: 520, y: 280 },
      { x: 78, y: 280 },
      { x: 300, y: 30 },
      { x: 300, y: 305 },
    ];
    const c = corners[i % corners.length];
    zones.push({
      zip: short(r.name),
      name: r.name,
      x: c.x,
      y: c.y,
      spend: r.spend,
      leads: r.conversions,
      cpl: r.cpl,
      status: 'leak',
    });
  });
  return zones;
}

function short(name: string): string {
  // Take up to 5 chars / first word.
  const w = name.split(/[\s,]+/)[0] ?? name;
  return w.substring(0, 8).toUpperCase();
}

function renderExecutionQueue(input: ReportInput): string {
  const phases = [
    {
      title: 'PHASE 1: STABILIZE',
      color: 'var(--red)',
      body:
        input.tracking.failures.length > 0
          ? input.tracking.failures[0].description
          : 'Tighten attribution windows and lock pixel hygiene across all campaigns.',
    },
    {
      title: 'PHASE 2: PIVOT',
      color: '#fff',
      body:
        input.geo.recommendation +
        (input.demographics.brackets.find((b) => b.outcome === 'REDUCE')
          ? ` Cap ${input.demographics.brackets.find((b) => b.outcome === 'REDUCE')?.bracket} demographic spend.`
          : ''),
    },
    {
      title: 'PHASE 3: SCALE',
      color: '#fff',
      body:
        input.creative.winners.length > 0
          ? `Scale winning creative "${input.creative.winners[0].headline || input.creative.winners[0].adName}" — ${input.creative.winners[0].reason}`
          : 'Build new creative tests around the strongest-performing ad set.',
    },
  ];
  return phases
    .map(
      (p) => `<div style="border: 1px solid var(--border); padding: 25px; border-top: 4px solid ${p.color};">
                        <h4 style="font-weight: 900; margin-bottom: 10px;">${escapeHtml(p.title)}</h4>
                        <p style="font-size: 12px; color: var(--text-dim); line-height: 1.5;">${escapeHtml(p.body)}</p>
                    </div>`,
    )
    .join('\n                    ');
}

// ---------- main ----------

export function generateReport(input: ReportInput, outputPath: string): void {
  // Try the colocated template first (works for both ts-node and compiled dist).
  // Fall back to the engine/report source template when running uncopied.
  const candidates = [
    path.join(__dirname, 'template.html'),
    path.join(__dirname, '..', '..', '..', 'engine', 'report', 'template.html'),
    path.join(process.cwd(), 'engine', 'report', 'template.html'),
  ];
  let templatePath = '';
  for (const c of candidates) {
    if (fs.existsSync(c)) { templatePath = c; break; }
  }
  if (!templatePath) {
    throw new Error('Could not locate template.html. Looked in: ' + candidates.join(', '));
  }
  const template = fs.readFileSync(templatePath, 'utf8');

  const geoZones = layoutGeoZones(input.geo.regions.slice(0, 12));
  const overallThreat: StatusLevel =
    input.tracking.overallScore < 50 || input.funnel.leakageScore > 60 ? 'critical' : input.funnel.leakageScore > 30 ? 'warn' : 'ok';

  // Sentinel block: show the broken-lead-campaign count.
  const trackingBroken = String(input.tracking.brokenLeadCampaigns).padStart(2, '0');
  const trackingWasteUsd = fmtUsd(input.tracking.totalWastedSpend);
  const trackingWastePct = input.spend.totalSpend > 0
    ? Math.min(100, (input.tracking.totalWastedSpend / input.spend.totalSpend) * 100).toFixed(1)
    : '0';

  const syncStatus = input.tracking.brokenLeadCampaigns > 0 ? 'DISCONNECTED' : 'NOMINAL';
  const apiStatus = input.tracking.failures.length === 0 ? 'NOMINAL' : input.tracking.failures.some((f) => f.severity === 'critical') ? 'FAILED' : 'DEGRADED';

  const trackingNarrative =
    input.tracking.failures.length === 0
      ? 'Tracking signals look intact across the audited window. No critical pixel anomalies detected.'
      : `Detected ${input.tracking.failures.length} tracking anomaly${input.tracking.failures.length === 1 ? '' : 'ies'}. ${input.tracking.failures[0].description}`;

  const headerStatus =
    overallThreat === 'critical'
      ? 'LIVE_DATA_RECONCILED // SESSION_INTEGRITY_CHECK: FAILED'
      : overallThreat === 'warn'
      ? 'LIVE_DATA_RECONCILED // SESSION_INTEGRITY_CHECK: DEGRADED'
      : 'LIVE_DATA_RECONCILED // SESSION_INTEGRITY_CHECK: NOMINAL';

  const systemId = (input.clientName.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase() || 'CLIENT') + '_RECON_V1';

  // Geo insight text
  let geoInsightTitle = 'GEOGRAPHIC SIEVE';
  let geoInsightBody = input.geo.recommendation;
  if (input.geo.regions.length === 0) {
    geoInsightTitle = 'GEOGRAPHIC SIEVE';
    geoInsightBody = 'No DMA-region breakdown CSV was provided. Export the DMA Region breakdown from Ads Manager to populate this panel.';
  } else {
    const leaks = input.geo.regions.filter((r) => r.status === 'leak');
    if (leaks.length > 0) {
      geoInsightTitle = `${(leaks[0].name.split(/[\s,-]+/)[0] || 'DMA').toUpperCase()} TRAP`;
      const inServ = input.geo.regions.filter((r) => r.status !== 'leak' && r.cpl > 0);
      const lo = inServ.length ? Math.min(...inServ.map((r) => r.cpl)) : 0;
      const hi = inServ.length ? Math.max(...inServ.map((r) => r.cpl)) : 0;
      const leakSum = leaks.reduce((a, r) => a + r.spend, 0);
      geoInsightBody = `${inServ.length} regions inside service area converting at $${lo.toFixed(0)}–$${hi.toFixed(0)} CPL. <b>$${fmtUsd(leakSum)}</b> is bleeding to ${leaks.map((l) => l.name).join(', ')} with <b>zero leads returned</b>.`;
    }
  }

  // Core region for the bullseye = highest-spend hot region.
  const coreRegion = input.geo.regions.find((r) => r.status === 'hot') ?? input.geo.regions[0];
  const coreLabel = coreRegion ? short(coreRegion.name) : 'CORE';
  const coreSummary = coreRegion
    ? `${coreRegion.conversions} LEADS · ${coreRegion.cpl > 0 ? '$' + coreRegion.cpl.toFixed(0) + ' CPL' : 'No leads'}`
    : 'No data';

  const funnelFinding =
    input.funnel.primaryLeak !== 'No critical leak detected.'
      ? `The ${input.funnel.clickToSessionLossPct}% gap between clicks and verified sessions points to <b>${input.funnel.primaryLeak.split('—')[0].trim()}</b>. Roughly ${Math.max(0, input.funnel.totalClicks - input.funnel.estimatedSessions).toLocaleString('en-US')} clicks did not become measurable sessions.`
      : `Funnel retention is within healthy bounds. Top of funnel delivered ${input.funnel.totalImpressions.toLocaleString('en-US')} impressions resulting in ${input.funnel.totalLeads.toLocaleString('en-US')} tracked leads.`;
  const funnelAction =
    input.funnel.leakageScore > 30
      ? 'Pause traffic-objective campaigns and reallocate budget to lead-form / conversion objectives. Re-audit landing-page pixel and form load times.'
      : 'Maintain current objective mix. Test new creative angles on top-performing ad sets to compound results.';

  const context: Record<string, string> = {
    CLIENT_NAME: input.clientName,
    CLIENT_NAME_UPPER: input.clientName.toUpperCase(),
    HEADER_STATUS: headerStatus,
    SYSTEM_ID: systemId,
    THREAT_LEVEL: overallThreat === 'critical' ? 'CRITICAL' : overallThreat === 'warn' ? 'ELEVATED' : 'NOMINAL',
    KPI_CARDS: renderKpiCards(input.spend.kpis),
    FUNNEL_STAGES: renderFunnelStages(input.funnel.stages),
    FUNNEL_FINDING: funnelFinding,
    FUNNEL_ACTION: funnelAction,
    TRACKING_BROKEN_LEAD_CAMPAIGNS: trackingBroken,
    TRACKING_HEADLINE_LABEL: input.tracking.brokenLeadCampaigns > 0 ? 'BROKEN_LEAD_CAMPAIGNS' : 'TRACKING_NOMINAL',
    TRACKING_WASTE_PCT: trackingWastePct,
    TRACKING_WASTE_USD: trackingWasteUsd,
    TRACKING_NARRATIVE: trackingNarrative,
    SYNC_STATUS: syncStatus,
    SYNC_STATUS_COLOR: syncStatus === 'NOMINAL' ? '#4ade80' : 'var(--red)',
    API_STATUS: apiStatus,
    API_STATUS_COLOR: apiStatus === 'NOMINAL' ? '#4ade80' : apiStatus === 'DEGRADED' ? '#facc15' : 'var(--red)',
    DEMO_TABLE_ROWS: renderDemoTable(input.demographics),
    GEO_ZONES_MAPPED: String(input.geo.zonesMapped).padStart(2, '0'),
    GEO_CORE_HOT: compactUsd(input.geo.coreHotSpend),
    GEO_LEAK_USD: fmtUsd(input.geo.wasteUSD),
    GEO_CORE_LABEL: coreLabel,
    GEO_CORE_SUMMARY: coreSummary,
    GEO_INSIGHT_TITLE: geoInsightTitle,
    GEO_INSIGHT_BODY: geoInsightBody,
    EXECUTION_QUEUE: renderExecutionQueue(input),
    DEMO_LABELS: JSON.stringify(input.demographics.chartLabels),
    DEMO_DATA: JSON.stringify(input.demographics.chartData),
    GEO_ZONES: JSON.stringify(geoZones),
  };

  const html = substitute(template, context);

  // Verify no leftover placeholders.
  const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) {
    console.warn(`[generator] Warning: ${leftover.length} unresolved placeholder(s): ${Array.from(new Set(leftover)).join(', ')}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');
}
