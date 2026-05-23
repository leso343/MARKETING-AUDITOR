/**
 * Placement breakdown analysis.
 *
 * Groups placement rows (Feed, Stories, Reels, Audience Network, etc.)
 * by the `placement` field, computes per-placement metrics, and scores
 * each placement on a 4-tier scale:
 *
 *   - winner:          CPL <= median (best performers)
 *   - acceptable:      CPL < 1.5x median
 *   - underperforming: CPL < 2x median
 *   - wasting:         CPL >= 2x median OR $50+ spend with 0 results
 *
 * `totalWaste` sums spend on all 'wasting' placements. The recommendation
 * names the worst offender and the best alternative.
 */
import { BreakdownRow } from '../types';
import { round } from './_shared';

export type PlacementScore = 'winner' | 'acceptable' | 'underperforming' | 'wasting';

export interface PlacementStat {
  name: string;
  spend: number;
  results: number;
  cpl: number;
  impressions: number;
  reach: number;
  ctr: number;
  score: PlacementScore;
}

export interface PlacementResult {
  placements: PlacementStat[];
  totalSpend: number;
  totalWaste: number;
  recommendation: string;
}

export function analyzePlacements(rows: BreakdownRow[]): PlacementResult {
  const placementRows = rows.filter((r) => r.breakdownKind === 'placement');

  // Aggregate by placement bucket.
  const agg = new Map<
    string,
    { spend: number; results: number; impressions: number; reach: number; clicks: number }
  >();

  for (const r of placementRows) {
    const key = r.placement ?? r.bucket;
    if (!key) continue;
    const cur = agg.get(key) ?? { spend: 0, results: 0, impressions: 0, reach: 0, clicks: 0 };
    cur.spend += r.amountSpent ?? 0;
    cur.results += r.results ?? 0;
    cur.impressions += r.impressions ?? 0;
    cur.reach += r.reach ?? 0;
    cur.clicks += r.linkClicks ?? 0;
    agg.set(key, cur);
  }

  const entries = Array.from(agg.entries()).map(([name, v]) => ({
    name,
    spend: round(v.spend, 2),
    results: v.results,
    cpl: v.results > 0 ? round(v.spend / v.results, 2) : 0,
    impressions: v.impressions,
    reach: v.reach,
    ctr: v.impressions > 0 ? round((v.clicks / v.impressions) * 100, 2) : 0,
  }));

  // Compute median CPL across placements that have conversions.
  const cpls = entries.filter((e) => e.cpl > 0).map((e) => e.cpl);
  const median = cpls.length
    ? cpls.sort((a, b) => a - b)[Math.floor(cpls.length / 2)]
    : 0;

  const totalSpend = entries.reduce((a, e) => a + e.spend, 0);

  // Score each placement.
  const placements: PlacementStat[] = entries.map((e) => {
    let score: PlacementScore;
    if (e.spend >= 50 && e.results === 0) {
      score = 'wasting';
    } else if (e.results === 0) {
      // Low spend, no results — not enough data but not a winner either.
      score = 'underperforming';
    } else if (median > 0 && e.cpl >= median * 2) {
      score = 'wasting';
    } else if (median > 0 && e.cpl >= median * 1.5) {
      score = 'underperforming';
    } else if (median > 0 && e.cpl > median) {
      score = 'acceptable';
    } else {
      score = 'winner';
    }
    return { ...e, score };
  });

  const totalWaste = round(
    placements.filter((p) => p.score === 'wasting').reduce((a, p) => a + p.spend, 0),
    2,
  );

  // Build recommendation.
  let recommendation = 'Placement spend is balanced across surfaces.';
  const wasting = placements
    .filter((p) => p.score === 'wasting')
    .sort((a, b) => b.spend - a.spend);
  const winners = placements
    .filter((p) => p.score === 'winner')
    .sort((a, b) => a.cpl - b.cpl);

  if (wasting.length > 0 && winners.length > 0) {
    const worst = wasting[0];
    const best = winners[0];
    if (worst.results === 0) {
      recommendation =
        `${worst.name} is consuming $${worst.spend.toLocaleString()} with 0 leads. ` +
        `Disable it and reallocate to ${best.name} which converts at $${best.cpl}/lead.`;
    } else {
      recommendation =
        `${worst.name} costs $${worst.cpl}/lead — ${round(worst.cpl / best.cpl, 1)}x more than ${best.name} ($${best.cpl}/lead). ` +
        `Shift budget away from ${worst.name} to cut waste.`;
    }
  } else if (wasting.length > 0) {
    const worst = wasting[0];
    recommendation =
      `${worst.name} is wasting $${worst.spend.toLocaleString()} with ${worst.results === 0 ? 'zero' : 'poor'} results. ` +
      `Pause it and monitor remaining placements.`;
  }

  return {
    placements: placements.sort((a, b) => b.spend - a.spend),
    totalSpend: round(totalSpend, 2),
    totalWaste,
    recommendation,
  };
}
