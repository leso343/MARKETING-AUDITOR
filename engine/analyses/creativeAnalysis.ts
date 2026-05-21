/**
 * Creative scoring.
 *
 * Per-ad metrics from the Ad-level CSV: CTR, CPC, CPL, frequency, rankings.
 * Top quartile by CPL = winners; bottom quartile with >$100 spend = wasters.
 *
 * CPL vs CPC methodology (matches spendEfficiency):
 *   - `cpl`  = spend / `Results` for the ad. Only meaningful when the ad's
 *              campaign objective was Leads/Conversions (so Results = lead-
 *              form submissions). For Traffic-objective ads, `Results`
 *              is link clicks — that case is the same number as `cpc`.
 *   - `cpc`  = either the parser-provided CPC (cost per link click) column,
 *              or derived from impressions * CTR / 100 when absent.
 *   - The dashboard chooses which to surface based on objective context;
 *     a Traffic-objective ad should be evaluated by CPC, a Leads-objective
 *     ad by CPL.
 */
import { AdRow, StatusLevel } from '../types';

/**
 * Whether a Meta "Result indicator" string corresponds to a lead-form
 * submission. Traffic / link-click / video / engagement rows must NOT be
 * counted as leads, even though they populate the same Results column.
 *
 * Returns true for lead-shaped indicators only. Empty / unknown → false
 * (the safer default: a row whose objective we can't identify cannot fake
 * a win by inflating leadlike counts).
 */
function isLeadIndicator(ri: string | undefined): boolean {
  if (!ri) return false;
  if (/link_click|landing_page_view|profile_visit|video_view|post_engagement/i.test(ri)) return false;
  return /lead|leadgen|fb_pixel_lead|onsite_conversion/i.test(ri);
}

export interface AdScore {
  adName: string;
  campaignName: string;
  headline: string;
  body: string;
  spend: number;
  results: number;
  cpl: number;
  cpc: number;
  ctr: number;
  frequency: number;
  status: StatusLevel;
  reason: string;
}

export interface CreativeAnalysisResult {
  winners: AdScore[];
  wasters: AdScore[];
  totalAds: number;
  totalSpend: number;
  blendedCpl: number;
  blendedCpc: number;
}

export function analyzeCreatives(ads: AdRow[]): CreativeAnalysisResult {
  // ── Bug fix: collapse duplicate Ad-name rows before scoring. ─────────────
  // Meta exports occasionally split the same ad across multiple rows
  // (delivery breakdowns, status changes, attribution windows, or daily-
  // rollup re-exports). Sorting + top-N before aggregation lets the same
  // ad surface in the winners list more than once. We group by
  // (campaignName, adName), sum additive metrics, and re-derive rate
  // metrics (CTR, CPC, CPL) from the totals so the scoring step
  // downstream sees one canonical row per ad.
  type Agg = {
    adName: string;
    adsetName: string;
    campaignName: string;
    headline: string;
    body: string;
    status: string;
    qualityRanking: string;
    engagementRateRanking: string;
    conversionRateRanking: string;
    spend: number;
    results: number;
    /** Subset of `results` from rows whose Result indicator is a lead
     *  event. Used for the blended-CPL totals so traffic-objective ads
     *  with 947 link clicks in Results can't fake a \$3.23 blended CPL. */
    leadResults: number;
    impressions: number;
    clicks: number; // derived from per-row impressions * CTR / 100
    parsedCpcSpend: number; // weighted parser-CPC fallback when CTR missing
    parsedCpcClicks: number;
    freqWeighted: number;
    freqWeight: number;
  };
  const aggMap = new Map<string, Agg>();
  for (const a of ads) {
    const key = `${a.campaignName} :: ${a.adName}`;
    let cur = aggMap.get(key);
    if (!cur) {
      cur = {
        adName: a.adName,
        adsetName: a.adsetName,
        campaignName: a.campaignName,
        headline: a.headline,
        body: a.body,
        status: a.status,
        qualityRanking: a.qualityRanking,
        engagementRateRanking: a.engagementRateRanking,
        conversionRateRanking: a.conversionRateRanking,
        spend: 0,
        results: 0,
        leadResults: 0,
        impressions: 0,
        clicks: 0,
        parsedCpcSpend: 0,
        parsedCpcClicks: 0,
        freqWeighted: 0,
        freqWeight: 0,
      };
      aggMap.set(key, cur);
    }
    cur.spend += a.amountSpent ?? 0;
    cur.results += a.results ?? 0;
    const ri = (a.raw && (a.raw['Result indicator'] || a.raw['Result Indicator'])) || '';
    if (isLeadIndicator(ri)) cur.leadResults += a.results ?? 0;
    const imps = a.impressions ?? 0;
    cur.impressions += imps;
    if (imps > 0 && a.ctr != null) {
      cur.clicks += (imps * a.ctr) / 100;
    }
    // Parser-provided CPC -> clicks, used as fallback when CTR is missing.
    if (a.cpc != null && a.cpc > 0 && (a.amountSpent ?? 0) > 0) {
      const rowClicks = (a.amountSpent ?? 0) / a.cpc;
      cur.parsedCpcSpend += a.amountSpent ?? 0;
      cur.parsedCpcClicks += rowClicks;
    }
    if (a.reach != null && a.reach > 0 && a.frequency != null) {
      cur.freqWeighted += a.reach * a.frequency;
      cur.freqWeight += a.reach;
    }
  }

  const scored: AdScore[] = Array.from(aggMap.values()).map((a) => {
    const spend = a.spend;
    const results = a.results;
    const cpl = results > 0 ? round(spend / results, 2) : 0;
    // CTR / CPC re-derived from aggregated totals so the scoring step
    // sees the true blended rate, not whichever single row came last.
    const ctr = a.impressions > 0 ? round((a.clicks / a.impressions) * 100, 4) : 0;
    let cpc = 0;
    if (a.clicks > 0) {
      cpc = round(spend / a.clicks, 2);
    } else if (a.parsedCpcClicks > 0) {
      cpc = round(a.parsedCpcSpend / a.parsedCpcClicks, 2);
    }
    const frequency = a.freqWeight > 0 ? round(a.freqWeighted / a.freqWeight, 2) : 0;
    return {
      adName: a.adName,
      campaignName: a.campaignName,
      headline: a.headline,
      body: a.body,
      spend: round(spend, 2),
      results,
      cpl,
      cpc,
      ctr,
      frequency,
      status: 'ok',
      reason: '',
    };
  });

  // Identify converters (results > 0 and spend > 0) for CPL ranking.
  const converters = scored.filter((s) => s.results > 0 && s.spend > 0).sort((a, b) => a.cpl - b.cpl);
  const wastersPool = scored.filter((s) => s.spend > 100 && s.results === 0);

  const winnerCutoff = Math.max(1, Math.ceil(converters.length * 0.25));
  const winners = converters.slice(0, winnerCutoff).map((w) => ({
    ...w,
    status: 'ok' as StatusLevel,
    reason: `Top-quartile CPL of $${w.cpl.toFixed(2)} at ${w.results} leads. Scale this angle.`,
  }));

  // Wasters: $100+ spent, zero conversions, OR bottom-quartile CPL with high spend.
  const bottomQuartileFromConverters = converters
    .slice(-Math.max(1, Math.ceil(converters.length * 0.25)))
    .filter((s) => s.spend > 100 && (s.cpl > (converters[0]?.cpl ?? 1) * 3))
    .map((w) => ({
      ...w,
      status: 'critical' as StatusLevel,
      reason: `CPL of $${w.cpl.toFixed(2)} is 3x your best performer at ${w.spend.toFixed(2)} spent.`,
    }));

  const wasters: AdScore[] = [
    ...wastersPool.map((w) => ({
      ...w,
      status: 'critical' as StatusLevel,
      reason: `$${w.spend.toFixed(2)} spent and 0 leads tracked. Pause immediately.`,
    })),
    ...bottomQuartileFromConverters,
  ]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  const totalSpend = scored.reduce((a, s) => a + s.spend, 0);
  // Sum only lead-indicator results across the grouped ads. The earlier
  // version used the full Results sum, which silently mixed link clicks
  // from traffic-objective ads (947 clicks for take-charge-roofing's
  // Traffic Ad) with real leadgen submissions and reported a \$3.23
  // blended CPL across the account.
  const totalLeadResults = Array.from(aggMap.values()).reduce((a, g) => a + g.leadResults, 0);
  const blendedCpl = totalLeadResults > 0 ? round(totalSpend / totalLeadResults, 2) : 0;

  // Blended CPC: prefer derived clicks (impressions * CTR) so it's defined
  // for every ad regardless of how the Results column was populated. Computed
  // from raw rows, not the aggregated `scored` set, to avoid double-rounding.
  let totalDerivedClicks = 0;
  for (const a of ads) {
    if (a.impressions != null && a.ctr != null) {
      totalDerivedClicks += (a.impressions * a.ctr) / 100;
    }
  }
  const blendedCpc = totalDerivedClicks > 0 ? round(totalSpend / totalDerivedClicks, 2) : 0;

  return {
    winners,
    wasters,
    totalAds: scored.length, // unique ads after aggregation
    totalSpend: round(totalSpend, 2),
    blendedCpl,
    blendedCpc,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
