/**
 * Hourly / dayparting analysis.
 *
 * Groups hourly breakdown rows (0-23) by the `hour` field, computes
 * per-hour metrics, and scores each hour:
 *
 *   - peak: CPL in the bottom 25% (cheapest quarter)
 *   - good: CPL below the median
 *   - low:  CPL above the median
 *   - dead: $20+ spend with 0 results (burning budget)
 *
 * Identifies `peakHours` (best 6 hours by CPL) and `deadHours` (hours
 * with $20+ spend and zero results). `potentialSavings` is the total
 * spend on 'dead' hours. The recommendation suggests a dayparting
 * schedule.
 */
import { BreakdownRow } from '../types';
import { round } from './_shared';

export type HourScore = 'peak' | 'good' | 'low' | 'dead';

export interface HourStat {
  hour: number;
  label: string; // "6am", "11pm", etc.
  spend: number;
  results: number;
  cpl: number;
  impressions: number;
  score: HourScore;
}

export interface TimeResult {
  hours: HourStat[];
  peakHours: number[];
  deadHours: number[];
  totalSpend: number;
  potentialSavings: number;
  recommendation: string;
}

/** Format 0-23 integer as "12am", "1pm", etc. */
function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

/** Collapse contiguous hours into range strings: [6,7,8,9,18,19,20] -> "6am-10am, 6pm-9pm". */
function formatRanges(sorted: number[]): string {
  if (sorted.length === 0) return '';
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      // End range covers up to prev+1 (exclusive end).
      ranges.push(`${formatHour(start)}-${formatHour((prev + 1) % 24)}`);
      if (i < sorted.length) {
        start = sorted[i];
        prev = sorted[i];
      }
    }
  }
  return ranges.join(' and ');
}

export function analyzeTimeOfDay(rows: BreakdownRow[]): TimeResult {
  const hourRows = rows.filter((r) => r.breakdownKind === 'hour');

  // Aggregate by hour bucket (0-23).
  const agg = new Map<number, { spend: number; results: number; impressions: number }>();

  for (const r of hourRows) {
    const raw = r.hour ?? r.bucket;
    if (raw == null || raw === '') continue;
    const h = parseInt(raw, 10);
    if (Number.isNaN(h) || h < 0 || h > 23) continue;
    const cur = agg.get(h) ?? { spend: 0, results: 0, impressions: 0 };
    cur.spend += r.amountSpent ?? 0;
    cur.results += r.results ?? 0;
    cur.impressions += r.impressions ?? 0;
    agg.set(h, cur);
  }

  const entries = Array.from(agg.entries())
    .map(([hour, v]) => ({
      hour,
      label: formatHour(hour),
      spend: round(v.spend, 2),
      results: v.results,
      cpl: v.results > 0 ? round(v.spend / v.results, 2) : 0,
      impressions: v.impressions,
    }))
    .sort((a, b) => a.hour - b.hour);

  // Compute median and 25th percentile CPL across hours with conversions.
  const cpls = entries.filter((e) => e.cpl > 0).map((e) => e.cpl).sort((a, b) => a - b);
  const median = cpls.length ? cpls[Math.floor(cpls.length / 2)] : 0;
  const p25 = cpls.length ? cpls[Math.floor(cpls.length * 0.25)] : 0;

  const totalSpend = entries.reduce((a, e) => a + e.spend, 0);

  // Score each hour.
  const hours: HourStat[] = entries.map((e) => {
    let score: HourScore;
    if (e.spend >= 20 && e.results === 0) {
      score = 'dead';
    } else if (e.results === 0) {
      // Low spend, no results — not enough data.
      score = 'low';
    } else if (p25 > 0 && e.cpl <= p25) {
      score = 'peak';
    } else if (median > 0 && e.cpl <= median) {
      score = 'good';
    } else {
      score = 'low';
    }
    return { ...e, score };
  });

  // Best 6 hours by CPL (only those with conversions).
  const withConversions = hours
    .filter((h) => h.cpl > 0)
    .sort((a, b) => a.cpl - b.cpl);
  const peakHours = withConversions.slice(0, 6).map((h) => h.hour).sort((a, b) => a - b);

  // Dead hours: $20+ spend, 0 results.
  const deadHours = hours
    .filter((h) => h.score === 'dead')
    .map((h) => h.hour)
    .sort((a, b) => a - b);

  const potentialSavings = round(
    hours.filter((h) => h.score === 'dead').reduce((a, h) => a + h.spend, 0),
    2,
  );

  // Build recommendation.
  let recommendation = 'Hourly performance is even — no dayparting changes needed.';

  if (peakHours.length > 0 && deadHours.length > 0) {
    const peakRange = formatRanges(peakHours);
    const deadRange = formatRanges(deadHours);
    recommendation =
      `Schedule ads during ${peakRange}. ` +
      `Kill ${deadRange} which wastes $${potentialSavings.toLocaleString()}/month with 0 conversions.`;
  } else if (deadHours.length > 0) {
    const deadRange = formatRanges(deadHours);
    recommendation =
      `Pause delivery during ${deadRange} to save $${potentialSavings.toLocaleString()}/month in wasted spend.`;
  } else if (peakHours.length > 0) {
    const peakRange = formatRanges(peakHours);
    recommendation =
      `Best performance during ${peakRange}. Consider increasing bids during these hours.`;
  }

  return {
    hours,
    peakHours,
    deadHours,
    totalSpend: round(totalSpend, 2),
    potentialSavings,
    recommendation,
  };
}
