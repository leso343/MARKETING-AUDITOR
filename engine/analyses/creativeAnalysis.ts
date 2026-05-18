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

export function analyzeCreatives(ads: AdRow[]): CreativeAnalysisResult {
  const scored: AdScore[] = ads.map((a) => {
    const spend = a.amountSpent ?? 0;
    const results = a.results ?? 0;
    const cpl = results > 0 ? round(spend / results, 2) : 0;
    return {
      adName: a.adName,
      campaignName: a.campaignName,
      headline: a.headline,
      body: a.body,
      spend: round(spend, 2),
      results,
      cpl,
      ctr: a.ctr ?? 0,
      frequency: a.frequency ?? 0,
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
    totalAds: ads.length,
    totalSpend: round(totalSpend, 2),
    blendedCpl,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
