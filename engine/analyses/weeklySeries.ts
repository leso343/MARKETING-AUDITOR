/**
 * Weekly time-series builder.
 *
 * Meta Ads Manager CSVs we ingest don't carry per-day rows by default, only
 * a single Reporting starts / Reporting ends window per row. To give the
 * TimeSeriesScrubber something real to graph, we bucket each ad's contribution
 * across whole weeks of its reporting window — proportional to days-in-week
 * vs total-days-in-window.
 *
 * This is a deliberate approximation, not a daily spend curve. Where Meta
 * later exports per-day data we can swap this implementation with no API
 * change to the visualiser.
 */

import { AdRow, CampaignRow } from "../types";

export interface WeeklySeriesPoint {
  /** Friendly week label, e.g. "Apr 1 – Apr 7" */
  weekLabel: string;
  /** ISO start date of the week (Monday-aligned) */
  weekStart: string;
  cpl: number;
  spend: number;
  /** All results (leads + clicks). Kept for backward compatibility. */
  leads: number;
  /** Results filtered to lead-indicator rows only. Falls back to `leads`
   *  when no result-indicator data is available in the export. */
  verifiedLeads: number;
  activeAdSets: string[];
}

/**
 * Whether a Meta "Result indicator" string corresponds to a lead-form
 * submission (as opposed to link clicks, video views, etc.).
 */
function isLeadIndicator(ri: string | undefined): boolean {
  if (!ri) return false;
  if (/link_click|landing_page_view|profile_visit|video_view|post_engagement/i.test(ri)) return false;
  return /lead|leadgen|fb_pixel_lead|onsite_conversion/i.test(ri);
}

const MS_PER_DAY = 86_400_000;

function startOfWeek(d: Date): Date {
  // Align to Monday (ISO week)
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  const day = out.getUTCDay(); // 0 = Sun, 1 = Mon
  const diff = (day === 0 ? -6 : 1 - day);
  out.setUTCDate(out.getUTCDate() + diff);
  return out;
}

function fmt(d: Date): string {
  const m = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${m} ${d.getUTCDate()}`;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Build weekly CPL buckets from ad rows.
 *
 * The `campaigns` parameter is accepted for API compatibility but is
 * intentionally NOT used here — ads are the leaf records, and each campaign
 * row is just an aggregate of its ads. Including both arrays would
 * double-count every dollar of spend (one row at the ad, one at the
 * campaign). Before this fix the take-charge-roofing dataset reported
 * ~$6,332 of weekly spend on a real $3,137 account and flattened per-week
 * CPL to $3.22 vs the true $101.20.
 */
export function buildWeeklySeries(
  campaigns: CampaignRow[],
  ads: AdRow[],
): WeeklySeriesPoint[] {
  void campaigns; // intentionally unused — see docblock above
  // Discover the overall window
  let windowStart: Date | null = null;
  let windowEnd: Date | null = null;
  const all = ads.map((a) => {
    const ri = (a.raw && (a.raw['Result indicator'] || a.raw['Result Indicator'])) || '';
    const isLead = isLeadIndicator(ri);
    const rawLeads = a.results ?? 0;
    return {
      start: parseDate(a.raw["Reporting starts"]),
      end: parseDate(a.raw["Reporting ends"]),
      spend: a.amountSpent ?? 0,
      // -- Bug fix: lead-objective rows only contribute to the lead
      // denominator. Traffic-objective ads with link-click Results still
      // pour their spend into the bucket but contribute zero leads — so
      // per-week CPL is no longer flattened by 947 link clicks counted as
      // "leads".
      leads: isLead ? rawLeads : 0,
      verifiedLeads: isLead ? rawLeads : 0,
      hasIndicator: ri !== '',
      adsetName: a.adsetName || a.adName,
    };
  }).filter((r) => r.start && r.end && (r.spend > 0 || r.leads > 0));

  // If no rows have result-indicator data, fall back: verifiedLeads = leads
  const hasAnyIndicator = all.some((r) => r.hasIndicator);
  if (!hasAnyIndicator) {
    for (const r of all) r.verifiedLeads = r.leads;
  }

  if (!all.length) return [];

  for (const r of all) {
    if (!windowStart || r.start! < windowStart) windowStart = r.start;
    if (!windowEnd || r.end! > windowEnd) windowEnd = r.end;
  }
  if (!windowStart || !windowEnd) return [];

  // Build week buckets (Mon-aligned) covering the window
  const first = startOfWeek(windowStart);
  const buckets: Map<string, WeeklySeriesPoint & { _names: Set<string>; _verifiedLeads: number }> = new Map();
  let cursor = new Date(first);
  while (cursor <= windowEnd) {
    const wkStart = new Date(cursor);
    const wkEnd = new Date(cursor);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
    const key = wkStart.toISOString().split("T")[0];
    buckets.set(key, {
      weekLabel: `${fmt(wkStart)} – ${fmt(wkEnd)}`,
      weekStart: key,
      cpl: 0,
      spend: 0,
      leads: 0,
      verifiedLeads: 0,
      activeAdSets: [],
      _names: new Set<string>(),
      _verifiedLeads: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  // Distribute each row's spend/leads across the weeks it overlaps,
  // proportional to days of overlap with that week
  for (const r of all) {
    const rStart = r.start!.getTime();
    const rEnd = r.end!.getTime() + MS_PER_DAY; // inclusive end → exclusive
    const totalDays = Math.max(1, (rEnd - rStart) / MS_PER_DAY);
    for (const [, b] of buckets) {
      const wStart = new Date(b.weekStart).getTime();
      const wEnd = wStart + 7 * MS_PER_DAY;
      const overlapStart = Math.max(rStart, wStart);
      const overlapEnd = Math.min(rEnd, wEnd);
      const overlapDays = Math.max(0, (overlapEnd - overlapStart) / MS_PER_DAY);
      if (overlapDays <= 0) continue;
      const share = overlapDays / totalDays;
      b.spend += r.spend * share;
      b.leads += r.leads * share;
      b._verifiedLeads += r.verifiedLeads * share;
      if (r.adsetName) b._names.add(r.adsetName);
    }
  }

  // Finalise
  const out: WeeklySeriesPoint[] = [];
  for (const [, b] of buckets) {
    if (b.spend <= 0 && b.leads <= 0) continue; // drop empty weeks
    const leadsRounded = Math.round(b.leads);
    const verifiedLeadsRounded = Math.round(b._verifiedLeads);
    out.push({
      weekLabel: b.weekLabel,
      weekStart: b.weekStart,
      spend: Math.round(b.spend * 100) / 100,
      leads: leadsRounded,
      verifiedLeads: verifiedLeadsRounded,
      cpl: leadsRounded > 0 ? Math.round((b.spend / leadsRounded) * 100) / 100 : 0,
      activeAdSets: Array.from(b._names).sort(),
    });
  }
  out.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return out;
}
