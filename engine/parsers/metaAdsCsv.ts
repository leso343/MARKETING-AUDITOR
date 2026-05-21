/**
 * Meta Ads Manager CSV parser.
 *
 * Meta exports are messy. This module:
 *   1. Reads a CSV via papaparse with header detection.
 *   2. Classifies the file (campaign / adset / ad / breakdown) by inspecting headers.
 *   3. Coerces values (strips $, %, comma-thousands; nulls "—" / "Not available").
 *   4. Skips totals rows and blank rows.
 *   5. Returns a typed discriminated union for downstream analyses.
 */
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import {
  AdRow,
  AdSetRow,
  BreakdownKind,
  BreakdownRow,
  CampaignRow,
  ParsedFile,
  ParsedRow,
  RowKind,
} from '../types';

// ---------- helpers ----------

const TOTAL_NAME_RX = /^(total|grand total|all campaigns|—)$/i;
const NA_VALUES = new Set(['', '-', '—', 'n/a', 'na', 'not available', 'unavailable', 'null']);

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (NA_VALUES.has(s.toLowerCase())) return null;
  // Strip currency symbols only (NOT commas — comma is a thousands-grouping char
  // handled by the dedicated lookahead below; including it in this char class
  // silently ate decimal commas in European-format numbers and stray commas in
  // malformed cells like '1,2', producing '12').
  s = s.replace(/[\$€£¥]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(/%$/, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toString(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (NA_VALUES.has(s.toLowerCase())) return '';
  return s;
}

/** Case-insensitive header lookup with fuzzy fallbacks (handles currency-suffix variants). */
function field(row: Record<string, string>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const exact = keys.find((k) => k.toLowerCase() === cl);
    if (exact) return row[exact];
  }
  // fuzzy: starts-with after lowercasing/normalising spaces
  for (const c of candidates) {
    const cl = c.toLowerCase().replace(/\s+/g, ' ');
    const hit = keys.find((k) => k.toLowerCase().replace(/\s+/g, ' ').startsWith(cl));
    if (hit) return row[hit];
  }
  return '';
}

function isTotalsRow(name: string): boolean {
  return !name || TOTAL_NAME_RX.test(name.trim());
}

// ---------- classification ----------

export interface ClassifiedHeaders {
  kind: RowKind;
  breakdownKind?: BreakdownKind;
}

const HEADER_HINTS = {
  ad: ['Ad name', 'Ad Name'],
  adset: ['Ad set name', 'Ad Set Name', 'Adset name'],
  campaign: ['Campaign name', 'Campaign Name'],
};


export function classify(headers: string[]): ClassifiedHeaders {
  const lc = headers.map((h) => h.toLowerCase());
  const has = (needle: string): boolean => lc.some((h) => h === needle.toLowerCase());

  // Detect breakdown column presence first.
  const bkHits: BreakdownKind[] = [];
  if (has('Age') || has('Gender')) bkHits.push('age_gender');
  if (has('Placement') || has('Platform')) bkHits.push('placement');
  if (has('DMA region') || has('Region') || has('Designated market area')) bkHits.push('dma');
  if (has('Device platform') || has('Impression device')) bkHits.push('device');
  if (has('Hour') || has('Time of day')) bkHits.push('hour');

  // Level signals.
  const hasAdName = HEADER_HINTS.ad.some((h) => has(h));
  const hasAdsetName = HEADER_HINTS.adset.some((h) => has(h));
  const hasCampaignName = HEADER_HINTS.campaign.some((h) => has(h));

  // Strong level signals win: an adset-level export contains Age/Locations columns
  // but is not a breakdown file. We treat Ad set name / Ad name as definitive.
  if (hasAdName) return { kind: 'ad' };

  // DMA region is a definitive breakdown signal even when "Ad set name" is present —
  // Meta exports DMA breakdowns at adset-level granularity, so both columns appear together.
  if (bkHits.includes('dma')) return { kind: 'breakdown', breakdownKind: 'dma' };

  if (hasAdsetName) return { kind: 'adset' };

  // True breakdown file: only campaign-level + breakdown columns, no adset/ad names.
  if (bkHits.length > 0) {
    return { kind: 'breakdown', breakdownKind: bkHits[0] };
  }

  if (hasCampaignName) return { kind: 'campaign' };
  return { kind: 'campaign' };
}

// ---------- row mappers ----------

function mapCampaign(r: Record<string, string>): CampaignRow | null {
  const name = toString(field(r, ['Campaign name', 'Campaign Name']));
  if (isTotalsRow(name)) return null;
  return {
    kind: 'campaign',
    campaignName: name,
    status: toString(field(r, ['Status', 'Delivery status'])),
    objective: toString(field(r, ['Objective', 'Campaign objective'])),
    bidStrategy: toString(field(r, ['Bid strategy', 'Bid Strategy'])),
    budget: toNumber(field(r, ['Budget', 'Campaign budget', 'Daily budget'])),
    attributionSetting: toString(field(r, ['Attribution setting', 'Attribution Setting'])),
    results: toNumber(field(r, ['Results', 'Result'])),
    resultIndicator: toString(field(r, ['Result indicator', 'Result Indicator'])),
    costPerResult: toNumber(field(r, ['Cost per result', 'Cost per results', 'Cost per Result'])),
    reach: toNumber(field(r, ['Reach'])),
    impressions: toNumber(field(r, ['Impressions'])),
    frequency: toNumber(field(r, ['Frequency'])),
    cpm: toNumber(field(r, ['Cost per 1,000 People Reached', 'CPM (cost per 1,000 impressions)', 'CPM'])),
    cpc: toNumber(field(r, ['CPC (cost per link click)', 'CPC (all)', 'CPC'])),
    ctr: toNumber(field(r, ['CTR (link click-through rate)', 'CTR (all)', 'CTR'])),
    amountSpent: toNumber(field(r, ['Amount spent (USD)', 'Amount Spent (USD)', 'Amount spent'])) ?? 0,
    ends: toString(field(r, ['Ends', 'End date', 'End'])),
    qualityRanking: toString(field(r, ['Quality ranking'])),
    engagementRateRanking: toString(field(r, ['Engagement rate ranking'])),
    conversionRateRanking: toString(field(r, ['Conversion rate ranking'])),
    raw: r,
  };
}

function mapAdSet(r: Record<string, string>): AdSetRow | null {
  const name = toString(field(r, ['Ad set name', 'Ad Set Name', 'Adset name']));
  if (isTotalsRow(name)) return null;
  return {
    kind: 'adset',
    adsetName: name,
    campaignName: toString(field(r, ['Campaign name', 'Campaign Name'])),
    status: toString(field(r, ['Status', 'Delivery status'])),
    objective: toString(field(r, ['Objective', 'Campaign objective'])),
    results: toNumber(field(r, ['Results', 'Result'])),
    costPerResult: toNumber(field(r, ['Cost per result', 'Cost per Result'])),
    reach: toNumber(field(r, ['Reach'])),
    impressions: toNumber(field(r, ['Impressions'])),
    frequency: toNumber(field(r, ['Frequency'])),
    ctr: toNumber(field(r, ['CTR (link click-through rate)', 'CTR (all)', 'CTR'])),
    cpc: toNumber(field(r, ['CPC (cost per link click)', 'CPC (all)', 'CPC'])),
    amountSpent: toNumber(field(r, ['Amount spent (USD)', 'Amount Spent (USD)', 'Amount spent'])) ?? 0,
    age: toString(field(r, ['Age'])),
    gender: toString(field(r, ['Gender'])),
    locations: toString(field(r, ['Locations', 'Location'])),
    raw: r,
  };
}

function mapAd(r: Record<string, string>): AdRow | null {
  const name = toString(field(r, ['Ad name', 'Ad Name']));
  if (isTotalsRow(name)) return null;
  return {
    kind: 'ad',
    adName: name,
    adsetName: toString(field(r, ['Ad set name', 'Ad Set Name'])),
    campaignName: toString(field(r, ['Campaign name', 'Campaign Name'])),
    status: toString(field(r, ['Status', 'Delivery status'])),
    headline: toString(field(r, ['Headline', 'Title'])),
    body: toString(field(r, ['Body', 'Body text', 'Primary text'])),
    creative: toString(field(r, ['Creative', 'Image name', 'Video title'])),
    results: toNumber(field(r, ['Results', 'Result'])),
    costPerResult: toNumber(field(r, ['Cost per result', 'Cost per Result'])),
    reach: toNumber(field(r, ['Reach'])),
    impressions: toNumber(field(r, ['Impressions'])),
    frequency: toNumber(field(r, ['Frequency'])),
    ctr: toNumber(field(r, ['CTR (link click-through rate)', 'CTR (all)', 'CTR'])),
    cpc: toNumber(field(r, ['CPC (cost per link click)', 'CPC (all)', 'CPC'])),
    amountSpent: toNumber(field(r, ['Amount spent (USD)', 'Amount Spent (USD)', 'Amount spent'])) ?? 0,
    qualityRanking: toString(field(r, ['Quality ranking'])),
    engagementRateRanking: toString(field(r, ['Engagement rate ranking'])),
    conversionRateRanking: toString(field(r, ['Conversion rate ranking'])),
    raw: r,
  };
}

function mapBreakdown(r: Record<string, string>, breakdownKind: BreakdownKind): BreakdownRow | null {
  const age = toString(field(r, ['Age']));
  const gender = toString(field(r, ['Gender']));
  const placement = toString(field(r, ['Placement', 'Platform']));
  const region = toString(field(r, ['DMA region', 'DMA Region', 'Region', 'Designated market area']));
  const device = toString(field(r, ['Device platform', 'Impression device']));
  const hour = toString(field(r, ['Hour', 'Time of day']));

  let bucket = '';
  if (breakdownKind === 'age_gender') bucket = [age, gender].filter(Boolean).join(' / ');
  else if (breakdownKind === 'placement') bucket = placement;
  else if (breakdownKind === 'dma') bucket = region;
  else if (breakdownKind === 'device') bucket = device;
  else if (breakdownKind === 'hour') bucket = hour;
  if (!bucket) return null;

  return {
    kind: 'breakdown',
    breakdownKind,
    bucket,
    age: age || undefined,
    gender: gender || undefined,
    placement: placement || undefined,
    region: region || undefined,
    device: device || undefined,
    hour: hour || undefined,
    campaignName: toString(field(r, ['Campaign name', 'Campaign Name'])) || undefined,
    results: toNumber(field(r, ['Results', 'Result'])),
    resultIndicator: toString(field(r, ['Result indicator', 'Result Indicator'])),
    leads: toNumber(field(r, ['Leads', 'Website leads', 'Meta leads'])),
    linkClicks: toNumber(field(r, ['Link clicks', 'Link Clicks'])),
    costPerResult: toNumber(field(r, ['Cost per result', 'Cost per Result', 'Cost per lead (USD)'])),
    reach: toNumber(field(r, ['Reach'])),
    impressions: toNumber(field(r, ['Impressions'])),
    ctr: toNumber(field(r, ['CTR (link click-through rate)', 'CTR (all)', 'CTR'])),
    cpc: toNumber(field(r, ['CPC (cost per link click)', 'CPC (all)', 'CPC'])),
    amountSpent: toNumber(field(r, ['Amount spent (USD)', 'Amount Spent (USD)', 'Amount spent'])) ?? 0,
    raw: r,
  };
}

// ---------- main parse ----------

export function parseMetaCsv(filePath: string): ParsedFile {
  const text = fs.readFileSync(filePath, 'utf8');
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const cls = classify(headers);
  const rows: ParsedRow[] = [];

  for (const r of result.data) {
    let mapped: ParsedRow | null = null;
    if (cls.kind === 'ad') mapped = mapAd(r);
    else if (cls.kind === 'adset') mapped = mapAdSet(r);
    else if (cls.kind === 'campaign') mapped = mapCampaign(r);
    else if (cls.kind === 'breakdown') mapped = mapBreakdown(r, cls.breakdownKind ?? 'unknown');
    if (mapped) rows.push(mapped);
  }

  return {
    kind: cls.kind,
    breakdownKind: cls.breakdownKind,
    filePath,
    rows,
  };
}

/** Auto-discover CSVs in a directory and parse them all. */
export function parseCsvDir(dir: string): ParsedFile[] {
  const out: ParsedFile[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.toLowerCase().endsWith('.csv')) continue;
    const full = path.join(dir, e.name);
    try {
      out.push(parseMetaCsv(full));
    } catch (err) {
      console.error(`[parser] Failed to parse ${full}: ${(err as Error).message}`);
    }
  }
  return out;
}
