/**
 * Metric verification for Take Charge Roofing audit.
 * Reads raw CSVs and computes the same metrics as the engine.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(__dirname, 'public', 'csvs', 'take-charge-roofing');

function toNum(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (['', '-', '—', 'n/a', 'na', 'not available', 'unavailable', 'null'].includes(s.toLowerCase())) return null;
  const cleaned = s.replace(/[$,€£¥]/g, '').replace(/%$/, '').trim();
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function loadCsv(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8').replace(/^﻿/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Simple CSV parse (handles quoted fields)
  function parseLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { fields.push(cur); cur = ''; }
      else { cur += line[i]; }
    }
    fields.push(cur);
    return fields;
  }
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
    return obj;
  });
}

function field(row, ...candidates) {
  for (const c of candidates) {
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === c.toLowerCase()) return v;
    }
  }
  return '';
}

const campaigns = loadCsv(join(CSV_DIR, 'campaigns.csv'));
const ads       = loadCsv(join(CSV_DIR, 'ads.csv'));
const breakdowns= loadCsv(join(CSV_DIR, 'breakdowns.csv'));
const ageBreak  = loadCsv(join(CSV_DIR, 'breakdown_age_gender.csv'));
const lastMonth = loadCsv(join(CSV_DIR, 'campaigns-last-month.csv'));

console.log('='.repeat(60));
console.log('TAKE CHARGE ROOFING — METRIC VERIFICATION');
console.log('='.repeat(60));
console.log(`\nFile row counts:`);
console.log(`  campaigns.csv:          ${campaigns.length} rows`);
console.log(`  ads.csv:                ${ads.length} rows`);
console.log(`  breakdowns.csv:         ${breakdowns.length} rows`);
console.log(`  breakdown_age_gender:   ${ageBreak.length} rows`);
console.log(`  campaigns-last-month:   ${lastMonth.length} rows`);

// ---- SPEND / KPIs ----
console.log('\n' + '='.repeat(60));
console.log('KPI METRICS (from campaigns.csv)');
console.log('='.repeat(60));

const totalSpend = campaigns.reduce((a, c) =>
  a + (toNum(field(c, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0), 0);
console.log(`\nTotal Spend (all-time):   $${totalSpend.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`);

// Lead results from campaigns by result_indicator
let leadsFromCampaigns = 0;
for (const c of campaigns) {
  const ri = field(c, 'Result indicator', 'Result Indicator').toLowerCase();
  const r  = toNum(field(c, 'Results', 'Result'));
  if (r != null && (ri.includes('lead') || ri.includes('conversion') || ri.includes('pixel_lead'))) {
    leadsFromCampaigns += r;
  }
}
console.log(`Total Leads (campaign result_indicator filter): ${leadsFromCampaigns}`);

// Engine uses c.objective (empty here) → isLeadObjective('') = false → falls back to ads
const totalLeadsFromAds = ads.reduce((a, ad) => a + (toNum(field(ad, 'Results', 'Result')) ?? 0), 0);
console.log(`Total Results (ad-level sum, all types): ${totalLeadsFromAds}`);
console.log(`\nEngine totalLeads (ads fallback): ${totalLeadsFromAds}`);

const blendedCpl = totalLeadsFromAds > 0 ? totalSpend / totalLeadsFromAds : 0;
console.log(`Engine Blended CPL:       $${blendedCpl.toFixed(2)}`);

const totalImpr = campaigns.reduce((a, c) => a + (toNum(field(c, 'Impressions')) ?? 0), 0);
const wCtrNum   = campaigns.reduce((a, c) => {
  const impr = toNum(field(c, 'Impressions')) ?? 0;
  const ctr  = toNum(field(c, 'CTR (link click-through rate)')) ?? 0;
  return a + impr * ctr;
}, 0);
const weightedCtr = totalImpr > 0 ? wCtrNum / totalImpr : 0;
const wCpmNum = campaigns.reduce((a, c) => {
  const impr = toNum(field(c, 'Impressions')) ?? 0;
  const cpm  = toNum(field(c, 'CPM (cost per 1,000 impressions) (USD)')) ?? 0;
  return a + impr * cpm;
}, 0);
const weightedCpm = totalImpr > 0 ? wCpmNum / totalImpr : 0;

console.log(`\nTotal Impressions:        ${totalImpr.toLocaleString()}`);
console.log(`Weighted CTR:             ${weightedCtr.toFixed(4)}%`);
console.log(`Weighted CPM:             $${weightedCpm.toFixed(2)}`);

const totalReach = campaigns.reduce((a, c) => a + (toNum(field(c, 'Reach')) ?? 0), 0);
const freqAcc = campaigns.reduce((a, c) => {
  const reach = toNum(field(c, 'Reach')) ?? 0;
  const freq  = toNum(field(c, 'Frequency')) ?? 0;
  return a + reach * freq;
}, 0);
const avgFreq = totalReach > 0 ? freqAcc / totalReach : 0;
console.log(`Average Frequency:        ${avgFreq.toFixed(4)}`);

// ---- GEOGRAPHIC ----
console.log('\n' + '='.repeat(60));
console.log('GEOGRAPHIC BREAKDOWN (from breakdowns.csv)');
console.log('='.repeat(60));

const dmaAgg = {};
for (const row of breakdowns) {
  const dma = field(row, 'DMA region', 'DMA Region', 'Region').trim();
  if (!dma) continue;
  const spend = toNum(field(row, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0;
  const res   = toNum(field(row, 'Results', 'Result')) ?? 0;
  if (!dmaAgg[dma]) dmaAgg[dma] = { spend: 0, leads: 0 };
  dmaAgg[dma].spend += spend;
  dmaAgg[dma].leads += res;
}

const sortedDmas = Object.entries(dmaAgg).sort((a, b) => b[1].spend - a[1].spend);
console.log(`\nDMA regions found (sorted by spend):`);
for (const [dma, stats] of sortedDmas) {
  const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
  const cplStr = stats.leads > 0 ? `$${cpl.toFixed(2)} CPL` : 'no leads';
  console.log(`  ${dma}: $${stats.spend.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} spend, ${stats.leads} leads, ${cplStr}`);
}

// ---- ADS ----
console.log('\n' + '='.repeat(60));
console.log('AD PERFORMANCE (from ads.csv)');
console.log('='.repeat(60));

const TOTAL_RX = /^(total|grand total|all campaigns|—)$/i;
const adsData = ads
  .map(a => ({
    name:    field(a, 'Ad name', 'Ad Name').trim(),
    spent:   toNum(field(a, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0,
    leads:   toNum(field(a, 'Results', 'Result')) ?? 0,
    impr:    toNum(field(a, 'Impressions')) ?? 0,
    ctr:     toNum(field(a, 'CTR (link click-through rate)')) ?? 0,
    status:  field(a, 'Ad delivery', 'Ad Delivery', 'Delivery status'),
    quality: field(a, 'Quality ranking'),
  }))
  .filter(a => a.name && !TOTAL_RX.test(a.name))
  .map(a => ({ ...a, cpl: a.leads > 0 ? a.spent / a.leads : 0 }));

const totalAdSpend = adsData.reduce((a, x) => a + x.spent, 0);
const totalAdResults = adsData.reduce((a, x) => a + x.leads, 0);
console.log(`\nTotal ad-level spend:     $${totalAdSpend.toLocaleString('en-US', {minimumFractionDigits:2})}`);
console.log(`Total ad-level results:   ${totalAdResults}`);

const winners = [...adsData].filter(a => a.leads > 0).sort((a, b) => a.cpl - b.cpl);
console.log(`\nTop 5 WINNING ads (lowest CPL):`);
winners.slice(0, 5).forEach((a, i) => {
  console.log(`  ${i+1}. ${a.name.substring(0,55)}: $${a.cpl.toFixed(2)} CPL, ${a.leads} leads, $${a.spent.toFixed(2)} spend`);
});

const wasters = [...adsData].filter(a => a.leads === 0 && a.spent > 10).sort((a, b) => b.spent - a.spent);
console.log(`\nTop 5 WASTING ads (high spend, zero leads):`);
wasters.slice(0, 5).forEach((a, i) => {
  console.log(`  ${i+1}. ${a.name.substring(0,55)}: $${a.spent.toFixed(2)} spend, 0 leads`);
});

// ---- AGE/GENDER ----
console.log('\n' + '='.repeat(60));
console.log('AGE/GENDER CPL DISTRIBUTION');
console.log('='.repeat(60));

const ageAgg = {};
for (const row of ageBreak) {
  const age = field(row, 'Age').trim();
  if (!age) continue;
  const spent = toNum(field(row, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0;
  const leads = toNum(field(row, 'Leads', 'Cost per lead (USD)').includes('per') ? '' : field(row, 'Leads')) ?? 0;
  if (!ageAgg[age]) ageAgg[age] = { spend: 0, leads: 0 };
  ageAgg[age].spend += spent;
  ageAgg[age].leads += leads;
}

// Try 'Leads' column specifically
const ageAgg2 = {};
for (const row of ageBreak) {
  const age = field(row, 'Age').trim();
  if (!age) continue;
  const spent = toNum(field(row, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0;
  // Try specific Leads column
  let leads = 0;
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toLowerCase() === 'leads') { leads = toNum(v) ?? 0; break; }
  }
  if (!ageAgg2[age]) ageAgg2[age] = { spend: 0, leads: 0 };
  ageAgg2[age].spend += spent;
  ageAgg2[age].leads += leads;
}

console.log(`\nAge group CPL distribution:`);
for (const [age, stats] of Object.entries(ageAgg2).sort()) {
  const cpl = stats.leads > 0 ? stats.spend / stats.leads : 0;
  const cplStr = stats.leads > 0 ? `$${cpl.toFixed(2)}` : '—';
  console.log(`  ${age}: $${stats.spend.toLocaleString('en-US',{minimumFractionDigits:2})} spend, ${stats.leads} leads, ${cplStr} CPL`);
}

// ---- LAST MONTH ----
console.log('\n' + '='.repeat(60));
console.log('LAST MONTH (Apr 15 – May 14 2026)');
console.log('='.repeat(60));
const lmSpend = lastMonth.reduce((a, c) => a + (toNum(field(c, 'Amount spent (USD)', 'Amount Spent (USD)')) ?? 0), 0);
const lmImpr  = lastMonth.reduce((a, c) => a + (toNum(field(c, 'Impressions')) ?? 0), 0);
const lmLeads = lastMonth.reduce((a, c) => {
  const ri = field(c, 'Result indicator', 'Result Indicator').toLowerCase();
  const r  = toNum(field(c, 'Results', 'Result'));
  return a + (r != null && (ri.includes('lead') || ri.includes('pixel')) ? r : 0);
}, 0);
console.log(`  Last-month spend:       $${lmSpend.toLocaleString('en-US',{minimumFractionDigits:2})}`);
console.log(`  Last-month impressions: ${lmImpr.toLocaleString()}`);
console.log(`  Last-month leads:       ${lmLeads}`);

// ---- SUMMARY ----
console.log('\n' + '='.repeat(60));
console.log('SUMMARY JSON');
console.log('='.repeat(60));
console.log(JSON.stringify({
  total_spend_campaigns: Math.round(totalSpend * 100) / 100,
  total_impressions: totalImpr,
  total_leads_from_ads: totalLeadsFromAds,
  blended_cpl: Math.round(blendedCpl * 100) / 100,
  weighted_ctr_pct: Math.round(weightedCtr * 10000) / 10000,
  weighted_cpm: Math.round(weightedCpm * 100) / 100,
  avg_frequency: Math.round(avgFreq * 10000) / 10000,
  dma_regions: sortedDmas.map(([dma, v]) => ({
    dma, spend: Math.round(v.spend * 100) / 100, leads: v.leads
  })),
  top_5_winners: winners.slice(0,5).map(a => ({
    name: a.name, cpl: Math.round(a.cpl * 100) / 100, leads: a.leads, spent: Math.round(a.spent * 100) / 100
  })),
  top_5_wasters: wasters.slice(0,5).map(a => ({
    name: a.name, spent: Math.round(a.spent * 100) / 100
  })),
  last_month: {
    spend: Math.round(lmSpend * 100) / 100,
    impressions: lmImpr,
    leads: lmLeads
  }
}, null, 2));
