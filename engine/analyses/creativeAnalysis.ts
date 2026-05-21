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
  const scored: AdScore[] = ads.map((a) => {
    const spend = a.amountSpent ?? 0;
    const results = a.results ?? 0;
    const cpl = results > 0 ? round(spend / results, 2) : 0;
    // Prefer parser-provided CPC; fall back to derived clicks if missing.
    let cpc = a.cpc ?? 0;
    if (!cpc && a.impressions != null && a.ctr != null && a.ctr > 0) {
      const derivedClicks = (a.impressions * a.ctr) / 100;
      cpc = derivedClicks > 0 ? round(spend / derivedClicks, 2) : 0;
    }
    return {
      adName: a.adName,
      campaignName: a.campaignName,
      headline: a.headline,
      body: a.body,
      spend: round(spend, 2),
      results,
      cpl,
      cpc: round(cpc, 2),
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
  // Per-ad results may be clicks (Traffic) or leads (Leads). Use cpl only when
  // any converter ad ran — otherwise it would falsely report "CPL" derived
  // from click counts.
  const anyConverters = converters.length > 0;
  const blendedCpl = anyConverters && totalResults > 0 ? round(totalSpend / totalResults, 2) : 0;

  // Blended CPC: prefer derived clicks (impressions * CTR) so it's defined
  // for every ad regardless of how the Results column was populated.
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
    totalAds: ads.length,
    totalSpend: round(totalSpend, 2),
    blendedCpl,
    blendedCpc,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
