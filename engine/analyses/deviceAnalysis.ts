/**
 * Device breakdown analysis.
 *
 * Groups device rows (Mobile, Desktop, Tablet, etc.) by the `device`
 * field, computes per-device metrics, and scores each on a 4-tier scale:
 *
 *   - winner:          CPL <= median (best performers)
 *   - acceptable:      CPL < 1.5x median
 *   - underperforming: CPL < 2x median
 *   - wasting:         CPL >= 2x median OR $50+ spend with 0 results
 *
 * `totalWaste` sums spend on all 'wasting' devices. The recommendation
 * compares the worst device to the best and suggests bid adjustments.
 */
import { BreakdownRow } from '../types';
import { round } from './_shared';

export type DeviceScore = 'winner' | 'acceptable' | 'underperforming' | 'wasting';

export interface DeviceStat {
  name: string;
  spend: number;
  results: number;
  cpl: number;
  impressions: number;
  ctr: number;
  score: DeviceScore;
}

export interface DeviceResult {
  devices: DeviceStat[];
  totalSpend: number;
  totalWaste: number;
  recommendation: string;
}

export function analyzeDevices(rows: BreakdownRow[]): DeviceResult {
  const deviceRows = rows.filter((r) => r.breakdownKind === 'device');

  // Aggregate by device bucket.
  const agg = new Map<
    string,
    { spend: number; results: number; impressions: number; clicks: number }
  >();

  for (const r of deviceRows) {
    const key = r.device ?? r.bucket;
    if (!key) continue;
    const cur = agg.get(key) ?? { spend: 0, results: 0, impressions: 0, clicks: 0 };
    cur.spend += r.amountSpent ?? 0;
    cur.results += r.results ?? 0;
    cur.impressions += r.impressions ?? 0;
    cur.clicks += r.linkClicks ?? 0;
    agg.set(key, cur);
  }

  const entries = Array.from(agg.entries()).map(([name, v]) => ({
    name,
    spend: round(v.spend, 2),
    results: v.results,
    cpl: v.results > 0 ? round(v.spend / v.results, 2) : 0,
    impressions: v.impressions,
    ctr: v.impressions > 0 ? round((v.clicks / v.impressions) * 100, 2) : 0,
  }));

  // Compute median CPL across devices that have conversions.
  const cpls = entries.filter((e) => e.cpl > 0).map((e) => e.cpl);
  const median = cpls.length
    ? cpls.sort((a, b) => a - b)[Math.floor(cpls.length / 2)]
    : 0;

  const totalSpend = entries.reduce((a, e) => a + e.spend, 0);

  // Score each device.
  const devices: DeviceStat[] = entries.map((e) => {
    let score: DeviceScore;
    if (e.spend >= 50 && e.results === 0) {
      score = 'wasting';
    } else if (e.results === 0) {
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
    devices.filter((d) => d.score === 'wasting').reduce((a, d) => a + d.spend, 0),
    2,
  );

  // Build recommendation.
  let recommendation = 'Device performance is balanced across platforms.';
  const wasting = devices
    .filter((d) => d.score === 'wasting')
    .sort((a, b) => b.spend - a.spend);
  const winners = devices
    .filter((d) => d.score === 'winner')
    .sort((a, b) => a.cpl - b.cpl);

  if (wasting.length > 0 && winners.length > 0) {
    const worst = wasting[0];
    const best = winners[0];
    if (worst.results === 0) {
      recommendation =
        `${worst.name} spent $${worst.spend.toLocaleString()} with 0 conversions. ` +
        `Exclude it and focus budget on ${best.name} ($${best.cpl}/lead).`;
    } else {
      const ratio = round(worst.cpl / best.cpl, 1);
      recommendation =
        `${worst.name} is ${ratio}x more expensive per lead than ${best.name}. ` +
        `Consider reducing ${worst.name.toLowerCase()} bid adjustments.`;
    }
  } else if (wasting.length > 0) {
    const worst = wasting[0];
    recommendation =
      `${worst.name} is wasting $${worst.spend.toLocaleString()} with ${worst.results === 0 ? 'zero' : 'poor'} results. ` +
      `Pause delivery on this device type.`;
  }

  return {
    devices: devices.sort((a, b) => b.spend - a.spend),
    totalSpend: round(totalSpend, 2),
    totalWaste,
    recommendation,
  };
}
