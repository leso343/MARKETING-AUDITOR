#!/usr/bin/env node
/**
 * SNA Marketing Auditor — CLI entry point.
 *
 * Usage:
 *   node dist/engine/index.js --csv-dir ./csvs/client --client "Client Name" --output ./reports/client.html
 *
 * Auto-discovers CSVs in --csv-dir, classifies them by header, runs all
 * analyses, and writes a self-contained HTML dashboard.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { parseCsvDir } from './parsers/metaAdsCsv';
import {
  AdRow,
  BreakdownRow,
  CampaignRow,
  ParsedFile,
  ParsedRow,
} from './types';
import { analyzeFunnelLeakage } from './analyses/funnelLeakage';
import { analyzeTrackingFailures } from './analyses/trackingFailures';
import { analyzeGeographicWaste } from './analyses/geographicWaste';
import { analyzeCreatives } from './analyses/creativeAnalysis';
import { analyzeSpendEfficiency } from './analyses/spendEfficiency';
import { analyzeDemographics } from './analyses/demographics';
import { generateReport } from './report/generator';

interface CliOpts {
  csvDir: string;
  client: string;
  output: string;
  targetCpl?: string;
  targetCtr?: string;
}

function flatRows<T extends ParsedRow>(files: ParsedFile[], kind: T['kind']): T[] {
  const out: T[] = [];
  for (const f of files) {
    if (f.kind === kind) {
      out.push(...(f.rows as T[]));
    }
  }
  return out;
}

function main(): void {
  const program = new Command();
  program
    .name('sna-audit')
    .description('SNA Marketing Auditor — Meta Ads CSV → forensic dashboard.')
    .requiredOption('--csv-dir <path>', 'Directory of Meta Ads Manager CSV exports')
    .requiredOption('--client <name>', 'Client name for the report header')
    .requiredOption('--output <path>', 'Output HTML path')
    .option('--target-cpl <usd>', 'Target CPL benchmark', '55')
    .option('--target-ctr <pct>', 'Target CTR benchmark (percent)', '1.5');

  program.parse(process.argv);
  const opts = program.opts<CliOpts>();

  const csvDir = path.resolve(opts.csvDir);
  if (!fs.existsSync(csvDir)) {
    console.error(`[engine] csv-dir does not exist: ${csvDir}`);
    process.exit(1);
  }

  console.log(`[engine] Parsing CSVs from ${csvDir}`);
  const files = parseCsvDir(csvDir);
  if (files.length === 0) {
    console.error('[engine] No CSV files found.');
    process.exit(1);
  }

  for (const f of files) {
    console.log(
      `[engine]   ${path.basename(f.filePath)} -> ${f.kind}${
        f.breakdownKind ? '/' + f.breakdownKind : ''
      } (${f.rows.length} rows)`,
    );
  }

  const campaigns = flatRows<CampaignRow>(files, 'campaign');
  const ads = flatRows<AdRow>(files, 'ad');
  const breakdowns = flatRows<BreakdownRow>(files, 'breakdown');

  if (campaigns.length === 0 && ads.length === 0 && breakdowns.length === 0) {
    console.error('[engine] No analysable rows after parsing. Check CSV headers.');
    process.exit(1);
  }

  const benchmarks = {
    targetCpl: Number(opts.targetCpl) || 55,
    targetCtr: Number(opts.targetCtr) || 1.5,
  };

  console.log('[engine] Running analyses...');
  const funnel = analyzeFunnelLeakage(campaigns, ads);
  const tracking = analyzeTrackingFailures(campaigns, ads);
  const geo = analyzeGeographicWaste(breakdowns);
  const creative = analyzeCreatives(ads);
  const spend = analyzeSpendEfficiency(campaigns, ads, breakdowns, benchmarks);
  const demographics = analyzeDemographics(breakdowns);

  console.log('[engine] Generating HTML report...');
  const outputPath = path.resolve(opts.output);
  try {
    generateReport(
      { clientName: opts.client, funnel, tracking, geo, creative, spend, demographics },
      outputPath,
    );
  } catch (err) {
    console.error(`[engine] Failed to generate report: ${(err as Error).message}`);
    process.exit(1);
  }

  // Stdout summary.
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`  SNA AUDIT — ${opts.client}`);
  console.log('═══════════════════════════════════════════');
  console.log(`  Total Spend:       $${spend.totalSpend.toFixed(2)}`);
  console.log(`  Tracked Leads:     ${spend.totalLeads}`);
  console.log(`  Blended CPL:       ${spend.blendedCpl > 0 ? '$' + spend.blendedCpl.toFixed(2) : '—'}  (lead-objective spend / lead form submissions)`);
  console.log(`  Blended CPC:       ${spend.weightedCpc > 0 ? '$' + spend.weightedCpc.toFixed(2) : '—'}  (total spend / link clicks)`);
  console.log(`  Weighted CTR:      ${spend.weightedCtr.toFixed(2)}%`);
  console.log(`  Funnel Leakage:    ${funnel.leakageScore.toFixed(1)}%`);
  console.log(`  Primary Leak:      ${funnel.primaryLeak}`);
  console.log(`  Tracking Score:    ${tracking.overallScore}/100`);
  console.log(`  Geographic Waste:  $${geo.wasteUSD.toFixed(2)}`);
  console.log(`  Creative Winners:  ${creative.winners.length}`);
  console.log(`  Creative Wasters:  ${creative.wasters.length}`);
  console.log('───────────────────────────────────────────');
  for (const f of tracking.failures) {
    const tag = f.severity === 'critical' ? '[CRIT]' : f.severity === 'warn' ? '[WARN]' : '[INFO]';
    console.log(`  ${tag} ${f.type}: ${f.description.substring(0, 80)}${f.description.length > 80 ? '...' : ''}`);
  }
  console.log('═══════════════════════════════════════════');
  console.log(`  Report written: ${outputPath}`);
  console.log('═══════════════════════════════════════════');
  process.exit(0);
}

main();
