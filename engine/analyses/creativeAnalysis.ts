/**
 * Creative scoring.
 *
 * Per-ad metrics from the Ad-level CSV: CTR, CPC, CPL, frequency, rankings.
 * Top quartile by CPL = winners; bottom quartile with >$100 spend = wasters.
 */
import { AdRow, StatusLevel } from '../types';

export interface AdScore {
  adName: string;
  campaignName: string;
  headline: string;
  body: string;
  spend: number;
  results: number;
  cpl: number;
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
}

/**
 * Whether a given Meta "Result indicator" string corresponds to an actual lead.
 * Pure traffic/link-click rows must not be counted as leads.
 */
function isLeadIndicator(ri: string | undefined): boolean {
  if (!ri) return false;
  if (/link_click|landing_page_view|profile_visit|video_view/i.test(ri)) return false;
  return /lead|leadgen|fb_pixel_lead|onsite_conversion/i.test(ri);
}

export function analyzeCreatives(ads: AdRow[]): CreativeAnalysisResult {
  // Group by ad name (Meta exports repeat the same creative once per ad set).
  // We aggregate spend, impressions, and leads across the same-named ad before
  // ranking — otherwise the same creative shows up 6+ times as both "winner"
  // and "waster" depending on which ad set it ran in.
  type Agg = {
    adName: string;
    campaignName: string;
    headline: string;
    body: string;
    spend: number;
    results: number;
    impressions: number;
    ctrAcc: number; // weighted by impressions
    freqAcc: number; // weighted by reach
    reach: number;
  };
  const grouped = new Map<string, Agg>();
  for (const a of ads) {
    const key = a.adName || '(unnamed)';
    const cur =
      grouped.get(key) ??
      {
        adName: a.adName,
        campaignName: a.campaignName,
        headline: a.headline,
        body: a.body,
        spend: 0,
        results: 0,
        impressions: 0,
        ctrAcc: 0,
        freqAcc: 0,
        reach: 0,
      };
    const ri = (a.raw && (a.raw['Result indicator'] || a.raw['Result Indicator'])) || '';
    cur.spend += a.amountSpent ?? 0;
    // Only count Results as leads when the row's Result indicator is a lead event.
    // Traffic-objective rows report Results = link clicks, which used to fake winners.
    if (isLeadIndicator(ri)) cur.results += a.results ?? 0;
    const imp = a.impressions ?? 0;
    cur.impressions += imp;
    if (imp && a.ctr !== null && a.ctr !== undefined) cur.ctrAcc += imp * a.ctr;
    const reach = a.reach ?? 0;
    cur.reach += reach;
    if (reach && a.frequency !== null && a.frequency !== undefined) cur.freqAcc += reach * a.frequency;
    grouped.set(key, cur);
  }

  const scored: AdScore[] = Array.from(grouped.values()).map((a) => {
    const cpl = a.results > 0 ? round(a.spend / a.results, 2) : 0;
    const ctr = a.impressions > 0 ? a.ctrAcc / a.impressions : 0;
    const frequency = a.reach > 0 ? a.freqAcc / a.reach : 0;
    return {
      adName: a.adName,
      campaignName: a.campaignName,
      headline: a.headline,
      body: a.body,
      spend: round(a.spend, 2),
      results: a.results,
      cpl,
      ctr: round(ctr, 2),
      frequency: round(frequency, 2),
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
  const totalResults = scored.reduce((a, s) => a + s.results, 0);
  const blendedCpl = totalResults > 0 ? round(totalSpend / totalResults, 2) : 0;

  return {
    winners,
    wasters,
    totalAds: scored.length,
    totalSpend: round(totalSpend, 2),
    blendedCpl,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
