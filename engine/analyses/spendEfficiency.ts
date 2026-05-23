/**
 * Spend efficiency / overall KPIs.
 *
 * Produces 5-8 KPI cards: total spend, blended CPL, blended CPC, weighted CTR,
 * average frequency, lead-objective campaigns with tracking issues, budget
 * pacing, and account-wide CPM.
 *
 * Methodology — CPL vs CPC:
 *   - "Blended CPL"  = total account spend / total lead-form submissions
 *                      (the latter comes strictly from lead-objective
 *                      campaigns — Meta's "Results" column when
 *                      Objective = Leads). Matches "I paid $X and got Y
 *                      leads → X/Y per lead", which is the client mental
 *                      model. The per-objective slice (lead-objective
 *                      spend only) is exposed as `leadObjectiveSpend`.
 *   - "Blended CPC"  = total spend / total link clicks (across all
 *                      objectives). Click counts are derived from
 *                      `impressions * CTR / 100` so they match Meta's CTR
 *                      definition (link CTR).
 *   - Older revisions of this engine fell back to summing all ad-level
 *     `Results` when no lead-objective campaigns were detected. That sum
 *     conflates clicks (Traffic objective) with leads (Leads objective),
 *     producing a "CPL" that was actually CPC. We no longer fall back —
 *     CPL is "—" when there are no lead-objective lead submissions, and
 *     CPC is reported as a separate KPI.
 */
import { CampaignRow, AdRow, BreakdownRow, KpiCard, StatusLevel } from '../types';
import { round, sum } from "./_shared";

export interface SpendEfficiencyResult {
  kpis: KpiCard[];
  totalSpend: number;
  totalLeads: number;
  totalClicks: number;
  leadObjectiveSpend: number;
  blendedCpl: number;
  weightedCpc: number;
  weightedCtr: number;
  weightedCpm: number;
  averageFrequency: number;
  campaignsWithAttribIssues: number;
  totalCampaigns: number;
}


function isLeadObjective(o: string, ri?: string): boolean {
  if (/lead|conversion|sales|appointment/i.test(o)) return true;
  // campaigns.csv often lacks an Objective column; use Result Indicator as fallback
  if (ri && /leadgen|lead|pixel_lead/i.test(ri)) return true;
  return false;
}

export function analyzeSpendEfficiency(
  campaigns: CampaignRow[],
  ads: AdRow[],
  _breakdowns: BreakdownRow[],
  benchmarks: { targetCpl: number; targetCtr: number } = { targetCpl: 55, targetCtr: 1.5 },
): SpendEfficiencyResult {
  const totalSpend = sum(campaigns.map((c) => c.amountSpent));

  // ── CPL: total spend / lead form submissions. ────────────────────────────
  // Matches Meta Ads Manager's "Cost per lead" view: the denominator is
  // strictly lead-form submissions (Results column on lead-objective
  // campaigns). The numerator is total account spend — clients think in
  // "I paid $X and got Y leads", not in per-objective slices.
  //
  // The old engine fell back to summing ad-level Results when no
  // lead-objective campaign was detected. That sum mixes clicks (Traffic
  // objective) with leads (Leads objective) and produced a "CPL" that was
  // actually CPC. That fallback is removed — when there are no
  // lead-form submissions, CPL is "—" and CPC carries the cost story.
  //
  // The lead-objective-only spend is exposed separately as
  // `leadObjectiveSpend` for downstream uses that want the purer
  // per-objective slice.
  const leadCampaigns = campaigns.filter((c) => isLeadObjective(c.objective, c.resultIndicator));
  const totalLeads = sum(leadCampaigns.map((c) => c.results));
  const leadObjectiveSpend = sum(leadCampaigns.map((c) => c.amountSpent));
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Weighted CTR & CPM over impressions.
  const totalImpressions = sum(campaigns.map((c) => c.impressions));
  let weightedCtrAcc = 0;
  let weightedCpmAcc = 0;
  for (const c of campaigns) {
    if (c.impressions) {
      if (c.ctr !== null) weightedCtrAcc += c.impressions * c.ctr;
      if (c.cpm !== null) weightedCpmAcc += c.impressions * c.cpm;
    }
  }
  const weightedCtr = totalImpressions > 0 ? weightedCtrAcc / totalImpressions : 0;
  const weightedCpm = totalImpressions > 0 ? weightedCpmAcc / totalImpressions : 0;

  // ── CPC: blended across all campaigns. Clicks ≈ impressions * CTR / 100. ──
  let totalClicks = 0;
  for (const c of campaigns) {
    if (c.impressions != null && c.ctr != null) {
      totalClicks += (c.impressions * c.ctr) / 100;
    }
  }
  // Fall back to ads-level CTR*impressions if campaign-level missing.
  if (totalClicks === 0) {
    for (const a of ads) {
      if (a.impressions != null && a.ctr != null) {
        totalClicks += (a.impressions * a.ctr) / 100;
      }
    }
  }
  const weightedCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  // Avg frequency (weighted by reach).
  const totalReach = sum(campaigns.map((c) => c.reach));
  let freqAcc = 0;
  for (const c of campaigns) {
    if (c.reach && c.frequency !== null) freqAcc += c.reach * c.frequency;
  }
  const averageFrequency = totalReach > 0 ? freqAcc / totalReach : 0;

  // ── Budget utilization: total spent vs total budget. ─────────────────────
  const campaignsWithBudget = campaigns.filter((c) => c.budget != null && c.budget > 0);
  const totalBudget = sum(campaignsWithBudget.map((c) => c.budget));
  const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

  const leadCampaignCount = leadCampaigns.length;
  const campaignsWithAttribIssues = campaigns.filter((c) => !c.attributionSetting).length;

  const cplStatus: StatusLevel =
    blendedCpl === 0
      ? 'warn' // unknown rather than critical — no lead-objective data
      : blendedCpl > benchmarks.targetCpl * 1.5
      ? 'critical'
      : blendedCpl > benchmarks.targetCpl
      ? 'warn'
      : 'ok';

  const ctrStatus: StatusLevel =
    weightedCtr === 0
      ? 'warn'
      : weightedCtr < benchmarks.targetCtr * 0.5
      ? 'critical'
      : weightedCtr < benchmarks.targetCtr
      ? 'warn'
      : 'ok';

  const freqStatus: StatusLevel =
    averageFrequency === 0 ? 'ok' : averageFrequency > 4 ? 'critical' : averageFrequency > 2.5 ? 'warn' : 'ok';

  const attribStatus: StatusLevel =
    campaigns.length === 0
      ? 'ok'
      : campaignsWithAttribIssues / campaigns.length > 0.5
      ? 'critical'
      : campaignsWithAttribIssues > 0
      ? 'warn'
      : 'ok';

  const budgetUtilStatus: StatusLevel =
    totalBudget === 0
      ? 'ok' // no budget data — skip judgment
      : budgetUtilization < 50 || budgetUtilization > 120
      ? 'critical'
      : budgetUtilization < 70 || budgetUtilization > 100
      ? 'warn'
      : 'ok';

  const kpis: KpiCard[] = [
    {
      label: 'Budget_Reconciled',
      value: '$' + fmt(totalSpend),
      unit: 'Total Audited Spend',
      status: 'ok',
      benchmark: `${campaigns.length} campaigns audited`,
    },
    {
      label: 'Campaign_Efficiency',
      value: weightedCtr.toFixed(2) + '%',
      unit: 'Weighted CTR (Avg)',
      status: ctrStatus,
      benchmark: `Target: ${benchmarks.targetCtr.toFixed(2)}%`,
    },
    {
      label: 'Control_CPL',
      value: blendedCpl > 0 ? '$' + blendedCpl.toFixed(2) : '—',
      unit: 'Blended CPL',
      status: cplStatus,
      benchmark: leadCampaignCount > 0
        ? `Target Benchmark: $${benchmarks.targetCpl.toFixed(2)}`
        : 'No lead-objective campaigns',
    },
    {
      label: 'Control_CPC',
      value: weightedCpc > 0 ? '$' + weightedCpc.toFixed(2) : '—',
      unit: 'Blended CPC',
      status: 'ok',
      benchmark: 'Total spend / link clicks',
    },
    {
      label: 'Lead_Volume',
      value: String(totalLeads),
      unit: 'Tracked Leads',
      status: totalLeads === 0 ? 'critical' : 'ok',
      benchmark: `Across ${leadCampaignCount} lead campaigns`,
    },
    {
      label: 'Reach_Saturation',
      value: averageFrequency.toFixed(2),
      unit: 'Avg Frequency',
      status: freqStatus,
      benchmark: 'Healthy <2.5, fatigue >4',
    },
    {
      label: 'Auction_Cost',
      value: weightedCpm > 0 ? '$' + weightedCpm.toFixed(2) : '—',
      unit: 'Weighted CPM',
      status: 'ok',
      benchmark: 'Cost per 1,000 impressions',
    },
    {
      label: 'Attribution_Health',
      value: campaigns.length > 0
        ? `${campaigns.length - campaignsWithAttribIssues}/${campaigns.length}`
        : '0/0',
      unit: 'Campaigns w/ Attribution',
      status: attribStatus,
      benchmark: 'Want 100% set',
    },
    ...(totalBudget > 0
      ? [
          {
            label: 'Budget_Utilization',
            value: Math.round(budgetUtilization) + '%',
            unit: 'Budget Utilization',
            status: budgetUtilStatus,
            benchmark: `$${fmt(totalSpend)} of $${fmt(totalBudget)} budget deployed`,
          },
        ]
      : []),
  ];

  return {
    kpis,
    totalSpend: round(totalSpend, 2),
    totalLeads,
    totalClicks: Math.round(totalClicks),
    leadObjectiveSpend: round(leadObjectiveSpend, 2),
    blendedCpl: round(blendedCpl, 2),
    weightedCpc: round(weightedCpc, 2),
    weightedCtr: round(weightedCtr, 2),
    weightedCpm: round(weightedCpm, 2),
    averageFrequency: round(averageFrequency, 2),
    campaignsWithAttribIssues,
    totalCampaigns: campaigns.length,
  };
}


function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
