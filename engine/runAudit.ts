/**
 * runAudit — server-side wrapper that calls the existing engine modules and
 * returns a single AuditResult that the Next.js page hands to its components.
 */
import { parseCsvDir } from "./parsers/metaAdsCsv";
import {
  AdRow,
  AdSetRow,
  BreakdownRow,
  CampaignRow,
  ParsedFile,
  ParsedRow,
} from "./types";
import { analyzeFunnelLeakage, FunnelLeakageResult } from "./analyses/funnelLeakage";
import { analyzeTrackingFailures, TrackingFailuresResult } from "./analyses/trackingFailures";
import { analyzeGeographicWaste, GeographicWasteResult } from "./analyses/geographicWaste";
import { analyzeCreatives, CreativeAnalysisResult } from "./analyses/creativeAnalysis";
import { analyzeSpendEfficiency, SpendEfficiencyResult } from "./analyses/spendEfficiency";
import { analyzeDemographics, DemographicsResult } from "./analyses/demographics";
import { buildWeeklySeries, WeeklySeriesPoint } from "./analyses/weeklySeries";
import { analyzePlacements, PlacementResult } from "./analyses/placementAnalysis";
import { analyzeDevices, DeviceResult } from "./analyses/deviceAnalysis";
import { analyzeTimeOfDay, TimeResult } from "./analyses/timeAnalysis";

export interface RunAuditOpts {
  csvDir: string;
  clientName: string;
  benchmarks?: { targetCpl: number; targetCtr: number };
  daysFilter?: number;
}

export interface ReportingPeriod {
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  filterDays: number | null;
  scaleFactor: number;
  isScaled: boolean;
}

export interface AuditResult {
  clientName: string;
  generatedAt: string;
  benchmarks: { targetCpl: number; targetCtr: number };
  reportingPeriod: ReportingPeriod;
  fileSummary: {
    name: string;
    kind: string;
    breakdownKind?: string;
    rows: number;
  }[];
  funnel: FunnelLeakageResult;
  tracking: TrackingFailuresResult;
  geo: GeographicWasteResult;
  creative: CreativeAnalysisResult;
  spend: SpendEfficiencyResult;
  demographics: DemographicsResult;
  weeklySeries: WeeklySeriesPoint[];
  placements: PlacementResult;
  devices: DeviceResult;
  timeOfDay: TimeResult;
}

/**
 * Extract rows of a given kind from parsed files.
 * @param activeOnly  When true, exclude rows where isActive === false
 *                    (paused/completed campaigns that skew averages).
 */
function flatRows<T extends ParsedRow>(files: ParsedFile[], kind: T["kind"], activeOnly?: boolean): T[] {
  const out: T[] = [];
  for (const f of files) {
    if (f.kind === kind) {
      for (const row of f.rows as T[]) {
        if (activeOnly && 'isActive' in row && !(row as any).isActive) continue;
        out.push(row);
      }
    }
  }
  return out;
}

/** Detect the reporting window from Reporting starts / Reporting ends columns in raw CSV data */
function detectReportingPeriod(rows: Array<{ raw: Record<string, string> }>): { start: Date | null; end: Date | null; days: number } {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const row of rows) {
    const s = new Date(row.raw["Reporting starts"] ?? "");
    const e = new Date(row.raw["Reporting ends"] ?? "");
    if (!isNaN(s.getTime()) && (!start || s < start)) start = s;
    if (!isNaN(e.getTime()) && (!end || e > end)) end = e;
  }
  const days = start && end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 : 0;
  return { start, end, days };
}

/** Proportionally scale spend/volume fields on campaign rows */
function scaleCampaigns(rows: CampaignRow[], factor: number): CampaignRow[] {
  if (factor >= 1) return rows;
  return rows.map((r) => ({
    ...r,
    amountSpent: (r.amountSpent ?? 0) * factor,
    results:     Math.round((r.results ?? 0) * factor),
    reach:       Math.round((r.reach ?? 0) * factor),
    impressions: Math.round((r.impressions ?? 0) * factor),
  }));
}

function scaleAds(rows: AdRow[], factor: number): AdRow[] {
  if (factor >= 1) return rows;
  return rows.map((r) => ({
    ...r,
    amountSpent: (r.amountSpent ?? 0) * factor,
    results:     Math.round((r.results ?? 0) * factor),
    impressions: Math.round((r.impressions ?? 0) * factor),
  }));
}

function scaleBreakdowns(rows: BreakdownRow[], factor: number): BreakdownRow[] {
  if (factor >= 1) return rows;
  return rows.map((r) => ({
    ...r,
    amountSpent: (r.amountSpent ?? 0) * factor,
    results:     Math.round((r.results ?? 0) * factor),
  }));
}

export function runAudit(opts: RunAuditOpts): AuditResult {
  const files = parseCsvDir(opts.csvDir);
  const rawCampaigns  = flatRows<CampaignRow>(files, "campaign");
  const rawAdsets     = flatRows<AdSetRow>(files, "adset");
  const rawAds        = flatRows<AdRow>(files, "ad");
  const rawBreakdowns = flatRows<BreakdownRow>(files, "breakdown");

  const benchmarks = opts.benchmarks ?? { targetCpl: 55, targetCtr: 1.5 };

  // Detect reporting period from CSV headers
  const period = detectReportingPeriod(rawCampaigns.length > 0 ? rawCampaigns : rawAds);
  const filterDays = opts.daysFilter ?? null;
  const scaleFactor =
    filterDays && period.days > 0 && filterDays < period.days
      ? filterDays / period.days
      : 1.0;

  const campaigns  = scaleCampaigns(rawCampaigns, scaleFactor);
  const ads        = scaleAds(rawAds, scaleFactor);
  const breakdowns = scaleBreakdowns(rawBreakdowns, scaleFactor);

  const reportingPeriod: ReportingPeriod = {
    startDate:  period.start?.toISOString().split("T")[0] ?? null,
    endDate:    period.end?.toISOString().split("T")[0] ?? null,
    totalDays:  period.days,
    filterDays,
    scaleFactor,
    isScaled:   scaleFactor < 1,
  };

  return {
    clientName: opts.clientName,
    generatedAt: new Date().toISOString(),
    benchmarks,
    reportingPeriod,
    fileSummary: files.map((f) => ({
      name: f.filePath.split(/[\\/]/).pop() ?? f.filePath,
      kind: f.kind,
      breakdownKind: f.breakdownKind,
      rows: f.rows.length,
    })),
    funnel:       analyzeFunnelLeakage(campaigns, ads),
    tracking:     analyzeTrackingFailures(campaigns, ads),
    geo:          analyzeGeographicWaste(breakdowns),
    creative:     analyzeCreatives(ads),
    spend:        analyzeSpendEfficiency(campaigns, ads, breakdowns, benchmarks),
    demographics: analyzeDemographics(breakdowns),
    weeklySeries: buildWeeklySeries(campaigns, ads),
    placements:   analyzePlacements(breakdowns),
    devices:      analyzeDevices(breakdowns),
    timeOfDay:    analyzeTimeOfDay(breakdowns),
  };
}
