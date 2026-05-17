/**
 * Spend efficiency / overall KPIs.
 *
 * Produces 5-7 KPI cards: total spend, blended CPL, weighted CTR, average
 * frequency, lead-objective campaigns with tracking issues, budget pacing,
 * and account-wide CPM.
 */
import { CampaignRow, AdRow, BreakdownRow, KpiCard, StatusLevel } from '../types';

export interface SpendEfficiencyResult {
  kpis: KpiCard[];
  totalSpend: number;
  totalLeads: number;
  blendedCpl: number;
  weightedCtr: number;
  weightedCpm: number;
  averageFrequency: number;
  campaignsWithAttribIssues: number;
  totalCampaigns: number;
}

function sum(nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((a, b) => a + (b ?? 0), 0);
}

function isLeadObjective(o: string): boolean {
  return /lead|conversion|sales|appointment/i.test(o);
}

export function analyzeSpendEfficiency(
  campaigns: CampaignRow[],
  ads: AdRow[],
  _breakdowns: BreakdownRow[],
  benchmarks: { targetCpl: number; targetCtr: number } = { targetCpl: 55, targetCtr: 1.5 },
): SpendEfficiencyResult {
  const totalSpend = sum(campaigns.map((c) => c.amountSpent));
  const totalLeads = sum(campaigns.filter((c) => isLeadObjective(c.objective)).map((c) => c.results)) ||
                     sum(ads.map((a) => a.results));
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

  // Avg frequency (weighted by reach).
  const totalReach = sum(campaigns.map((c) => c.reach));
  let freqAcc = 0;
  for (const c of campaigns) {
    if (c.reach && c.frequency !== null) freqAcc += c.reach * c.frequency;
  }
  const averageFrequency = totalReach > 0 ? freqAcc / totalReach : 0;

  const campaignsWithAttribIssues = campaigns.filter((c) => !c.attributionSetting).length;

  const cplStatus: StatusLevel =
    blendedCpl === 0
      ? 'critical'
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
      benchmark: `Target Benchmark: $${benchmarks.targetCpl.toFixed(2)}`,
    },
    {
      label: 'Lead_Volume',
      value: String(totalLeads),
      unit: 'Tracked Leads',
      status: totalLeads === 0 ? 'critical' : 'ok',
      benchmark: `Across ${campaigns.filter((c) => isLeadObjective(c.objective)).length} lead campaigns`,
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
  ];

  return {
    kpis,
    totalSpend: round(totalSpend, 2),
    totalLeads,
    blendedCpl: round(blendedCpl, 2),
    weightedCtr: round(weightedCtr, 2),
    weightedCpm: round(weightedCpm, 2),
    averageFrequency: round(averageFrequency, 2),
    campaignsWithAttribIssues,
    totalCampaigns: campaigns.length,
  };
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
