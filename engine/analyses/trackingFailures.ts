/**
 * Tracking failure detection.
 *
 * Without raw pixel data we infer failures from CSV signals:
 *   - "Quality / Engagement / Conversion rate ranking" missing across the account
 *     (Meta only reports these once pixel events fire reliably).
 *   - Campaigns with non-zero spend and zero Results AND a lead objective.
 *   - Missing attribution-setting column for a chunk of campaigns.
 *
 * Each failure carries a severity, a description, and an estimated dollar impact.
 */
import { CampaignRow, AdRow, StatusLevel } from '../types';
import { round } from "./_shared";

export interface TrackingFailure {
  type: string;
  severity: StatusLevel;
  description: string;
  estimatedImpact: number; // USD
  affectedCampaigns: string[];
}

export interface TrackingFailuresResult {
  failures: TrackingFailure[];
  overallScore: number; // 0 = broken, 100 = clean
  totalWastedSpend: number;
  brokenLeadCampaigns: number;
  totalLeadCampaigns: number;
}

function isLeadObjective(o: string, ri?: string, name?: string): boolean {
  if (/lead|conversion|sales|appointment/i.test(o)) return true;
  // Campaign exports from Meta routinely have an empty Objective column.
  // Use the Result indicator as a fallback (it carries leadgen.other,
  // fb_pixel_lead, onsite_conversion.lead, etc.).
  if (ri && /leadgen|^lead$|pixel_lead|onsite_conversion\.lead/i.test(ri)) return true;
  // Last resort: campaign-name prefix. Many agencies tag lead-objective
  // campaigns 'LF…', 'Lead…', 'Lead Form…' — this catches the
  // broken-tracking case where Objective AND Result indicator are BOTH
  // empty, Results is 0, but the campaign spent money. That row is the
  // exact pattern this analyser exists to surface.
  if (name && /^(lf\b|lead\b|lead form|lead generation)/i.test(name.trim())) return true;
  return false;
}

export function analyzeTrackingFailures(
  campaigns: CampaignRow[],
  ads: AdRow[],
): TrackingFailuresResult {
  const failures: TrackingFailure[] = [];
  let wastedSpend = 0;

  // 1) Lead-objective campaigns with spend but zero tracked results.
  const leadCampaigns = campaigns.filter((c) => isLeadObjective(c.objective, c.resultIndicator, c.campaignName));
  const brokenLeadCampaigns = leadCampaigns.filter(
    (c) => c.amountSpent > 10 && (c.results ?? 0) === 0,
  );
  if (brokenLeadCampaigns.length > 0) {
    const impact = brokenLeadCampaigns.reduce((a, c) => a + c.amountSpent, 0);
    wastedSpend += impact;
    failures.push({
      type: 'LEAD_PIXEL_DISCONNECTED',
      severity: 'critical',
      description: `${brokenLeadCampaigns.length} lead-objective campaign(s) spent money but reported 0 leads. Pixel / CAPI is almost certainly disconnected for these campaigns.`,
      estimatedImpact: round(impact, 2),
      affectedCampaigns: brokenLeadCampaigns.map((c) => c.campaignName),
    });
  }

  // 2) Missing Quality/Engagement/Conversion rankings across the account.
  const rankableAds = ads.filter((a) => a.amountSpent > 0);
  const missingRanking = rankableAds.filter(
    (a) =>
      !a.qualityRanking && !a.engagementRateRanking && !a.conversionRateRanking,
  );
  if (rankableAds.length > 0 && missingRanking.length / rankableAds.length > 0.6) {
    const impact = missingRanking.reduce((a, c) => a + c.amountSpent, 0) * 0.15;
    failures.push({
      type: 'RANKING_DATA_MISSING',
      severity: 'warn',
      description: `${missingRanking.length} of ${rankableAds.length} ads are missing quality / engagement / conversion rankings. Meta only computes these once events fire reliably — strong indicator of pixel mis-fires.`,
      estimatedImpact: round(impact, 2),
      affectedCampaigns: dedupe(missingRanking.map((a) => a.campaignName)),
    });
  }

  // 3) Missing attribution setting across many campaigns.
  const noAttr = campaigns.filter((c) => !c.attributionSetting);
  if (campaigns.length > 0 && noAttr.length / campaigns.length > 0.5) {
    failures.push({
      type: 'ATTRIBUTION_WINDOW_UNSET',
      severity: 'warn',
      description: `${noAttr.length} of ${campaigns.length} campaigns have no attribution setting recorded. Default 7d-click windows may be under-counting conversions.`,
      estimatedImpact: 0,
      affectedCampaigns: noAttr.slice(0, 8).map((c) => c.campaignName),
    });
  }

  // 4) Lead-objective campaigns whose result indicator is *not* a lead event.
  const wrongIndicator = leadCampaigns.filter(
    (c) =>
      c.resultIndicator &&
      !/lead|conversion|purchase|sale|complete/i.test(c.resultIndicator),
  );
  if (wrongIndicator.length > 0) {
    failures.push({
      type: 'WRONG_OPTIMIZATION_EVENT',
      severity: 'critical',
      description: `${wrongIndicator.length} lead-objective campaign(s) are optimising for a non-lead event (${wrongIndicator[0].resultIndicator}). The algorithm is hunting the wrong outcome.`,
      estimatedImpact: round(wrongIndicator.reduce((a, c) => a + c.amountSpent, 0) * 0.25, 2),
      affectedCampaigns: wrongIndicator.map((c) => c.campaignName),
    });
  }

  // Score: start at 100, deduct per failure.
  let score = 100;
  for (const f of failures) {
    score -= f.severity === 'critical' ? 35 : f.severity === 'warn' ? 15 : 5;
  }
  score = Math.max(0, score);

  return {
    failures,
    overallScore: score,
    totalWastedSpend: round(wastedSpend, 2),
    brokenLeadCampaigns: brokenLeadCampaigns.length,
    totalLeadCampaigns: leadCampaigns.length,
  };
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

