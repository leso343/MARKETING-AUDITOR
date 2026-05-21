/**
 * Geographic waste detection.
 *
 * Groups DMA / Region rows by bucket name, computes spend / Results per region,
 * and flags:
 *   - hot:    cost-per-result <= median, positive results
 *   - mixed:  cost-per-result within [median, 2x median]
 *   - cold:   cost-per-result > 2x median OR low result volume with high spend
 *   - leak:   spend > $50 AND zero results (likely out-of-service-area)
 *
 * Note on the `cpl` field: it is literally `spend / Results` per bucket. When
 * the campaign objective was Leads, this is true cost-per-lead. When the
 * objective was Traffic, `Results` is link clicks and the field is really
 * cost-per-click. The dashboard relabels the column accordingly using the
 * `costMetricLabel` prop on GeographicHeatmap. See spendEfficiency.ts for
 * the canonical CPL vs CPC methodology.
 */
import { BreakdownRow, StatusLevel } from '../types';

export type GeoStatus = 'hot' | 'mixed' | 'cold' | 'leak';

export interface RegionStat {
  name: string;
  spend: number;
  conversions: number;
  cpl: number;
  status: GeoStatus;
  cssStatus: StatusLevel;
  share: number; // 0-1 share of total spend
}

export interface GeographicWasteResult {
  regions: RegionStat[];
  wasteUSD: number;
  totalSpend: number;
  zonesMapped: number;
  coreHotSpend: number;
  recommendation: string;
}

export function analyzeGeographicWaste(rows: BreakdownRow[]): GeographicWasteResult {
  const dmaRows = rows.filter((r) => r.breakdownKind === 'dma');
  // Aggregate by bucket.
  const agg = new Map<string, { spend: number; conversions: number }>();
  for (const r of dmaRows) {
    const cur = agg.get(r.bucket) ?? { spend: 0, conversions: 0 };
    cur.spend += r.amountSpent ?? 0;
    cur.conversions += r.results ?? 0;
    agg.set(r.bucket, cur);
  }

  const entries = Array.from(agg.entries()).map(([name, v]) => ({
    name,
    spend: round(v.spend, 2),
    conversions: v.conversions,
    cpl: v.conversions > 0 ? round(v.spend / v.conversions, 2) : 0,
  }));

  const cpls = entries.filter((e) => e.cpl > 0).map((e) => e.cpl);
  const median = cpls.length ? cpls.sort((a, b) => a - b)[Math.floor(cpls.length / 2)] : 0;
  const totalSpend = entries.reduce((a, e) => a + e.spend, 0);

  const regions: RegionStat[] = entries.map((e) => {
    let status: GeoStatus;
    let cssStatus: StatusLevel;
    if (e.spend > 50 && e.conversions === 0) {
      status = 'leak';
      cssStatus = 'critical';
    } else if (e.conversions === 0) {
      status = 'cold';
      cssStatus = 'warn';
    } else if (median > 0 && e.cpl > median * 2) {
      status = 'cold';
      cssStatus = 'warn';
    } else if (median > 0 && e.cpl > median * 1.25) {
      status = 'mixed';
      cssStatus = 'warn';
    } else {
      status = 'hot';
      cssStatus = 'ok';
    }
    return {
      name: e.name,
      spend: e.spend,
      conversions: e.conversions,
      cpl: e.cpl,
      status,
      cssStatus,
      share: totalSpend > 0 ? e.spend / totalSpend : 0,
    };
  });

  const wasteUSD = round(
    regions.filter((r) => r.status === 'leak' || r.status === 'cold').reduce((a, r) => a + r.spend, 0),
    2,
  );
  const coreHotSpend = round(
    regions.filter((r) => r.status === 'hot').reduce((a, r) => a + r.spend, 0),
    2,
  );

  let recommendation = 'Geographic spend is balanced.';
  const leaks = regions.filter((r) => r.status === 'leak');
  if (leaks.length > 0) {
    recommendation = `Hard-cap delivery to your service radius. ${leaks
      .map((r) => r.name)
      .join(', ')} are bleeding spend with zero converted leads.`;
  } else if (regions.some((r) => r.status === 'cold')) {
    recommendation =
      'Reduce or pause cold DMAs running 2x median CPL. Reallocate to the top two hot zones.';
  }

  return {
    regions: regions.sort((a, b) => b.spend - a.spend),
    wasteUSD,
    totalSpend: round(totalSpend, 2),
    zonesMapped: regions.length,
    coreHotSpend,
    recommendation,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
