/**
 * runAudit — server-side wrapper that calls the existing engine modules and
 * returns a single AuditResult that the Next.js page hands to its components.
 *
 * This is the "head" the React UI replaces. The CLI in `engine/index.ts` still
 * exists for the static-HTML path; both share the same analyses.
 */
import { parseCsvDir } from "./parsers/metaAdsCsv";
import {
  AdRow,
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

export interface RunAuditOpts {
  csvDir: string;
  clientName: string;
  benchmarks?: {
    targetCpl: number;
    targetCtr: number;
  };
  daysFilter?: number;
}

export interface AuditResult {
  clientName: string;
  generatedAt: string;
  benchmarks: { targetCpl: number; targetCtr: number };
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
}

function flatRows<T extends ParsedRow>(
  files: ParsedFile[],
  kind: T["kind"],
): T[] {
  const out: T[] = [];
  for (const f of files) {
    if (f.kind === kind) {
      out.push(...(f.rows as T[]));
    }
  }
  return out;
}

export function runAudit(opts: RunAuditOpts): AuditResult {
  const files = parseCsvDir(opts.csvDir);
  const campaigns = flatRows<CampaignRow>(files, "campaign");
  const ads = flatRows<AdRow>(files, "ad");
  const breakdowns = flatRows<BreakdownRow>(files, "breakdown");

  const benchmarks = opts.benchmarks ?? { targetCpl: 55, targetCtr: 1.5 };

  return {
    clientName: opts.clientName,
    generatedAt: new Date().toISOString(),
    benchmarks,
    fileSummary: files.map((f) => ({
      name: f.filePath.split(/[\\/]/).pop() ?? f.filePath,
      kind: f.kind,
      breakdownKind: f.breakdownKind,
      rows: f.rows.length,
    })),
    funnel: analyzeFunnelLeakage(campaigns, ads),
    tracking: analyzeTrackingFailures(campaigns, ads),
    geo: analyzeGeographicWaste(breakdowns),
    creative: analyzeCreatives(ads),
    spend: analyzeSpendEfficiency(campaigns, ads, breakdowns, benchmarks),
    demographics: analyzeDemographics(breakdowns),
  };
}
