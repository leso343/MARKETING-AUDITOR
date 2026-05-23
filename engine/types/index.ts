/**
 * Shared types for Blank Page Audits engine.
 *
 * Meta Ads Manager CSV exports come in several flavours; we normalise them to
 * the discriminated union below so downstream analyses can stay flat.
 */

export type RowKind = 'campaign' | 'adset' | 'ad' | 'breakdown';

export interface CampaignRow {
  kind: 'campaign';
  campaignName: string;
  status: string;
  /** true when status is "Active" (case-insensitive); use with flatRows(activeOnly) to exclude paused/completed campaigns. */
  isActive: boolean;
  objective: string;
  bidStrategy: string;
  budget: number | null;
  attributionSetting: string;
  results: number | null;
  resultIndicator: string; // e.g. "actions:onsite_conversion.lead_grouped"
  costPerResult: number | null;
  reach: number | null;
  impressions: number | null;
  frequency: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  amountSpent: number;
  /** Meta "Landing page views" column; 0 when absent. */
  landingPageViews: number;
  ends: string;
  qualityRanking: string;
  engagementRateRanking: string;
  conversionRateRanking: string;
  raw: Record<string, string>;
}

export interface AdSetRow {
  kind: 'adset';
  adsetName: string;
  campaignName: string;
  status: string;
  /** true when status is "Active" (case-insensitive). */
  isActive: boolean;
  objective: string;
  results: number | null;
  costPerResult: number | null;
  reach: number | null;
  impressions: number | null;
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  amountSpent: number;
  age: string;
  gender: string;
  locations: string;
  raw: Record<string, string>;
}

export interface AdRow {
  kind: 'ad';
  adName: string;
  adsetName: string;
  campaignName: string;
  status: string;
  /** true when status is "Active" (case-insensitive). */
  isActive: boolean;
  headline: string;
  body: string;
  creative: string;
  results: number | null;
  costPerResult: number | null;
  reach: number | null;
  impressions: number | null;
  frequency: number | null;
  ctr: number | null;
  cpc: number | null;
  amountSpent: number;
  /** Meta "Landing page views" column; 0 when absent. */
  landingPageViews: number;
  qualityRanking: string;
  engagementRateRanking: string;
  conversionRateRanking: string;
  raw: Record<string, string>;
}

export type BreakdownKind = 'age_gender' | 'placement' | 'dma' | 'device' | 'hour' | 'unknown';

export interface BreakdownRow {
  kind: 'breakdown';
  breakdownKind: BreakdownKind;
  /** Human-readable label for the breakdown bucket (e.g. "Miami-Ft. Lauderdale" or "Facebook Feed"). */
  bucket: string;
  age?: string;
  gender?: string;
  placement?: string;
  region?: string;
  device?: string;
  hour?: string;
  campaignName?: string;
  /** Generic Meta "Results" column — may be link clicks, leads, etc.
   *  depending on the row's Result indicator. */
  results: number | null;
  /** Result indicator (e.g. "actions:leadgen.other") describing what the
   *  Results column means for this row. Empty string when absent. */
  resultIndicator: string;
  /** True lead count from the dedicated "Leads" column when present
   *  (age/gender exports). Null when the column is absent. */
  leads: number | null;
  /** "Link clicks" column when present. Null when absent. */
  linkClicks: number | null;
  costPerResult: number | null;
  reach: number | null;
  impressions: number | null;
  ctr: number | null;
  cpc: number | null;
  amountSpent: number;
  raw: Record<string, string>;
}

export type ParsedRow = CampaignRow | AdSetRow | AdRow | BreakdownRow;

export interface ParsedFile {
  kind: RowKind;
  breakdownKind?: BreakdownKind;
  filePath: string;
  rows: ParsedRow[];
}

/** Status colour for any benchmark check. */
export type StatusLevel = 'ok' | 'warn' | 'critical';

export interface KpiCard {
  label: string;
  value: string;
  unit: string;
  status: StatusLevel;
  benchmark: string;
}
