/**
 * Demographic waste detection — age & gender breakdown.
 *
 * Aggregates spend, leads, and CPL per age bracket; flags brackets above 2x
 * median CPL as wasteful and below median as scalable.
 */
import { BreakdownRow, StatusLevel } from '../types';

export interface AgeBracketStat {
  bracket: string;
  spend: number;
  leads: number;
  cpl: number;
  status: StatusLevel;
  outcome: 'SCALABLE' | 'MIXED' | 'REDUCE' | 'NO_DATA';
}

export interface DemographicsResult {
  brackets: AgeBracketStat[];
  /** Series for the chart (Chart.js line). Indexed by AGE_BUCKETS. */
  chartLabels: string[];
  chartData: number[]; // CPL per bracket (0 = missing)
}

const AGE_BUCKETS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export function analyzeDemographics(rows: BreakdownRow[]): DemographicsResult {
  const ageRows = rows.filter((r) => r.breakdownKind === 'age_gender' && r.age);
  const agg = new Map<string, { spend: number; leads: number }>();
  for (const b of AGE_BUCKETS) agg.set(b, { spend: 0, leads: 0 });

  for (const r of ageRows) {
    const a = (r.age ?? '').trim();
    const key = AGE_BUCKETS.find((b) => b === a) ?? null;
    if (!key) continue;
    const cur = agg.get(key)!;
    cur.spend += r.amountSpent ?? 0;
    cur.leads += r.results ?? 0;
  }

  const brackets: AgeBracketStat[] = AGE_BUCKETS.map((b) => {
    const v = agg.get(b)!;
    const cpl = v.leads > 0 ? round(v.spend / v.leads, 2) : 0;
    return { bracket: b, spend: round(v.spend, 2), leads: v.leads, cpl, status: 'ok' as StatusLevel, outcome: 'NO_DATA' as const };
  });

  const cpls = brackets.filter((b) => b.cpl > 0).map((b) => b.cpl);
  const median = cpls.length ? cpls.sort((a, b) => a - b)[Math.floor(cpls.length / 2)] : 0;

  for (const b of brackets) {
    if (b.spend === 0) {
      b.outcome = 'NO_DATA';
      b.status = 'ok';
    } else if (b.cpl === 0) {
      b.outcome = 'REDUCE';
      b.status = 'critical';
    } else if (median > 0 && b.cpl > median * 1.8) {
      b.outcome = 'REDUCE';
      b.status = 'critical';
    } else if (median > 0 && b.cpl > median * 1.2) {
      b.outcome = 'MIXED';
      b.status = 'warn';
    } else {
      b.outcome = 'SCALABLE';
      b.status = 'ok';
    }
  }

  return {
    brackets,
    chartLabels: AGE_BUCKETS,
    chartData: brackets.map((b) => b.cpl),
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
