/**
 * Funnel Leakage detection.
 *
 * Builds Impression -> Click -> Landing -> Form Submit -> Lead stages from the
 * parsed campaign and ad rows. "Click" comes from impressions * (CTR/100) when
 * CTR is reported, or from Results when the objective is traffic.
 *
 * We score retention at each stage against industry benchmarks and surface the
 * weakest stage as the "primary leak".
 */
import { CampaignRow, AdRow, StatusLevel } from '../types';
import { round, sum } from "./_shared";

export interface FunnelStage {
  name: string;
  count: number;
  retentionPct: number; // % of previous stage that made it here (100 for first stage)
  status: StatusLevel;
  note: string;
}

export interface FunnelLeakageResult {
  stages: FunnelStage[];
  leakageScore: number; // 0 (perfect) - 100 (catastrophic)
  primaryLeak: string;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  estimatedSessions: number;
  clickToSessionLossPct: number;
  /** True when the CSV contained a "Landing page views" column with data,
   *  meaning the USER_ARRIVAL stage uses real numbers instead of a heuristic. */
  landingPageViewsAvailable: boolean;
}


function isTrafficObjective(o: string): boolean {
  return /traffic|link.?click|reach|aware|engagement/i.test(o);
}

function isLeadObjective(o: string, ri?: string): boolean {
  if (/lead|conversion|sales|appointment/i.test(o)) return true;
  if (ri && /leadgen|lead|pixel_lead/i.test(ri)) return true;
  return false;
}

export function analyzeFunnelLeakage(
  campaigns: CampaignRow[],
  ads: AdRow[],
): FunnelLeakageResult {
  const totalImpressions = sum(campaigns.map((c) => c.impressions));
  // -- Bug fix: use ONE source for link clicks, not both. -------------------
  // The earlier implementation added `weightedClicks` (impressions * CTR/100)
  // AND `trafficClicks` (Results from traffic-objective campaigns) together,
  // which double-counts every traffic-objective row: Meta reports the same
  // link-click count in BOTH the CTR-derived total and the Results column
  // when the objective is Traffic. For take-charge-roofing's "Traffic Ad"
  // (947 link clicks), the old code surfaced ~2,561 clicks (1,614 CTR-derived
  // + 947 Results) instead of the true 1,614, inflating click-to-session
  // loss to 79.5% when the truth is 67.4%.
  //
  // Preferred source: the explicit "Link clicks" column from the CSV (raw).
  // Fallback when that column is empty or absent: impressions * CTR/100,
  // computed ONCE per campaign with no Results-based addition on top.
  const rawLinkClicksSum = sum(
    campaigns.map((c) => {
      const raw = (c as any).raw || {};
      const v = raw['Link clicks'] ?? raw['Link Clicks'] ?? raw['link_clicks'];
      const n = v == null || v === '' ? NaN : Number(v);
      return Number.isFinite(n) ? n : 0;
    }),
  );

  let totalClicks: number;
  if (rawLinkClicksSum > 0) {
    totalClicks = Math.round(rawLinkClicksSum);
  } else {
    let weightedClicks = 0;
    for (const c of campaigns) {
      if (!c.impressions || c.ctr === null) continue;
      // Skip pure top-of-funnel objectives where CTR isn't link-click rate.
      if (/reach|brand|engagement/i.test(c.objective)) continue;
      weightedClicks += c.impressions * (c.ctr / 100);
    }
    totalClicks = Math.round(weightedClicks);
  }

  // Leads: results from lead-objective campaigns; fall back to ad-level results.
  let totalLeads = sum(campaigns.filter((c) => isLeadObjective(c.objective, c.resultIndicator)).map((c) => c.results));
  if (totalLeads === 0) {
    totalLeads = sum(ads.map((a) => a.results));
  }

  // Landing page views: prefer the real "Landing page views" column from the CSV
  // when available (parsed as `landingPageViews` on CampaignRow). Fall back to
  // the heuristic arrival-rate estimate when the column is absent or all-zero.
  const realLandingPageViews = sum(
    campaigns.map((c) => (c as any).landingPageViews ?? 0),
  );
  const landingPageViewsAvailable = realLandingPageViews > 0;

  let estimatedSessions: number;
  if (landingPageViewsAvailable) {
    estimatedSessions = realLandingPageViews;
  } else {
    // Heuristic: estimated sessions = clicks * realistic landing arrival rate.
    // For traffic objectives the gap is large (accidental clicks). We use 0.45 as
    // a conservative default.
    const trafficShare =
      totalImpressions > 0
        ? sum(campaigns.filter((c) => isTrafficObjective(c.objective)).map((c) => c.impressions)) /
          totalImpressions
        : 0;
    const arrivalRate = 0.85 - 0.4 * trafficShare; // 0.45 if 100% traffic, 0.85 if 0% traffic
    estimatedSessions = Math.round(totalClicks * Math.max(0.4, Math.min(0.92, arrivalRate)));
  }

  const ctrPct = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const clickToSession = totalClicks > 0 ? (estimatedSessions / totalClicks) * 100 : 0;
  const sessionToLead = estimatedSessions > 0 ? (totalLeads / estimatedSessions) * 100 : 0;

  const stages: FunnelStage[] = [
    {
      name: 'AD_INTEREST (IMPRESSIONS)',
      count: totalImpressions,
      retentionPct: 100,
      status: 'ok',
      note: 'Top of funnel — paid reach delivered.',
    },
    {
      name: 'CLICKS PURCHASED',
      count: totalClicks,
      retentionPct: round(ctrPct, 2),
      status: ctrPct < 0.5 ? 'critical' : ctrPct < 1 ? 'warn' : 'ok',
      note:
        ctrPct < 0.5
          ? 'CTR below 0.5% — creative is failing to earn the click.'
          : ctrPct < 1
          ? 'CTR under 1% — soft. Refresh creative angle.'
          : 'CTR healthy.',
    },
    {
      name: landingPageViewsAvailable
        ? 'LANDING_PAGE_VIEWS (Verified)'
        : 'USER_ARRIVAL (Estimated)',
      count: estimatedSessions,
      retentionPct: round(clickToSession, 1),
      status: clickToSession < 30 ? 'critical' : clickToSession < 50 ? 'warn' : 'ok',
      note:
        clickToSession < 30
          ? 'Massive click-to-session gap. Traffic objectives are buying accidental clicks.'
          : clickToSession < 50
          ? 'Click-to-session loss above industry norm. Audit pixel and landing speed.'
          : 'Click-to-session within healthy range.',
    },
    {
      name: 'LEAD_CONVERSION (TRACKED)',
      count: totalLeads,
      retentionPct: round(sessionToLead, 2),
      status: sessionToLead < 1 ? 'critical' : sessionToLead < 5 ? 'warn' : 'ok',
      note:
        sessionToLead < 1
          ? 'Near-zero session-to-lead. Form failure or tracking failure.'
          : sessionToLead < 5
          ? 'Below 5% session-to-lead. Form friction or weak offer.'
          : 'Session-to-lead healthy.',
    },
  ];

  // Primary leak = stage with worst status, prefer earlier critical stage.
  let primaryLeak = 'No critical leak detected.';
  let leakageScore = 0;
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const cur = stages[i];
    if (prev.count > 0) {
      const lost = prev.count - cur.count;
      const lossPct = (lost / prev.count) * 100;
      if (cur.status === 'critical') {
        leakageScore = Math.max(leakageScore, Math.min(100, lossPct));
        if (primaryLeak === 'No critical leak detected.') {
          primaryLeak = `${cur.name} — ${lossPct.toFixed(1)}% loss vs prior stage.`;
        }
      } else if (cur.status === 'warn') {
        leakageScore = Math.max(leakageScore, Math.min(70, lossPct * 0.7));
      }
    }
  }

  // Specifically expose click-to-session loss (this is the headline leak in the original audit).
  const clickToSessionLossPct = totalClicks > 0 ? round(100 - clickToSession, 1) : 0;

  return {
    stages,
    leakageScore: round(leakageScore, 1),
    primaryLeak,
    totalImpressions,
    totalClicks,
    totalLeads,
    estimatedSessions,
    clickToSessionLossPct,
    landingPageViewsAvailable,
  };
}

