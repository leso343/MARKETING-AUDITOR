/**
 * Demographic waste detection — age & gender breakdown.
 *
 * Aggregates spend, leads, and CPL per age bracket; flags brackets above 1.8x
 * median CPL as wasteful and below 1.2x median as scalable.
 *
 * ── Lead-count source ────────────────────────────────────────────────────
 * Meta's `Results` column on a breakdown export reflects whatever the
 * source campaign's "Result" was: lead-form submissions on Leads-objective
 * campaigns, but link clicks on Traffic-objective ones. Mixing those
 * inflates the lead total for any bracket where Traffic spend ran, which
 * in turn distorts the per-bracket CPL (and the median used for the
 * status thresholds).
 *
 * Meta exports a dedicated `Leads` column (alongside `Website leads`,
 * `Meta leads`, and `Cost per lead`) on age/gender breakdowns. That
 * column strictly counts lead-form submissions and is blank for
 * Traffic-objective rows. We prefer that column. When it's present on
 * the row (even if blank), we treat blank as 0 leads — the row's a
 * Traffic-objective slice. We only fall back to `Results` when the
 * Leads column is absent from the file entirely, so older exports that
 * predate the column still work. This is the same canonical pattern
 * used in `spendEfficiency.ts` — leads come from a leads-only source,
 * never from `Results` on mixed-objective data.
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

const LEADS_HEADERS = ['Leads', 'leads', 'Lead', 'Total leads'] as const;

/** True if any row in the set has a Leads-style header at all. Detects
 *  whether the exporter included the lead-form column. */
function leadsColumnPresent(rows: BreakdownRow[]): boolean {
  for (const r of rows) {
    if (!r.raw) continue;
    for (const h of LEADS_HEADERS) {
      if (Object.prototype.hasOwnProperty.call(r.raw, h)) return true;
    }
  }
  return false;
}

/** Pull lead-form submissions from the row. Pass `useLeadsCol=true` when
 *  the file is known to expose a Leads column — blank cells in that case
 *  are real 0s (Traffic-objective rows). When the column is absent
 *  entirely, fall back to Results so legacy exports still work. */
function leadsFor(r: BreakdownRow, useLeadsCol: boolean): number {
  if (useLeadsCol) {
    for (const key of LEADS_HEADERS) {
      const v = r.raw?.[key];
      if (v == null || v === '') continue;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
      if (!Number.isNaN(n)) return n;
    }
    // Column present on file but blank on this row -> 0 leads (Traffic row).
    return 0;
  }
  // Pre-`Leads`-column exporters: fall back to Results.
  return r.results ?? 0;
}

export function analyzeDemographics(rows: BreakdownRow[]): DemographicsResult {
  const ageRows = rows.filter((r) => r.breakdownKind === 'age_gender' && r.age);
  const useLeadsCol = leadsColumnPresent(ageRows);
  const agg = new Map<string, { spend: number; leads: number }>();
  for (const b of AGE_BUCKETS) agg.set(b, { spend: 0, leads: 0 });

  for (const r of ageRows) {
    const a = (r.age ?? '').trim();
    const key = AGE_BUCKETS.find((b) => b === a) ?? null;
    if (!key) continue;
    const cur = agg.get(key)!;
    cur.spend += r.amountSpent ?? 0;
    cur.leads += leadsFor(r, useLeadsCol);
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
