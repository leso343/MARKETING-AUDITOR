"""
Metric verification for Take Charge Roofing audit.
Reads raw CSVs and computes the same metrics the engine produces.
"""
import csv, json, re, math
from pathlib import Path

CSV_DIR = Path(__file__).parent / "public" / "csvs" / "take-charge-roofing"

def to_num(v):
    if v is None: return None
    s = str(v).strip()
    if s in ('', '-', '—', 'n/a', 'na', 'not available', 'unavailable', 'null'):
        return None
    s = re.sub(r'[$,€£¥]', '', s).replace('%', '').strip()
    try: return float(s)
    except: return None

def load_csv(path):
    rows = []
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows

def field(row, *candidates):
    for c in candidates:
        for k, v in row.items():
            if k.strip().lower() == c.lower():
                return v
    return ''

# ---------- load files ----------
campaigns = load_csv(CSV_DIR / 'campaigns.csv')
ads       = load_csv(CSV_DIR / 'ads.csv')
breakdowns= load_csv(CSV_DIR / 'breakdowns.csv')
age_break = load_csv(CSV_DIR / 'breakdown_age_gender.csv')

print("=" * 60)
print("TAKE CHARGE ROOFING — METRIC VERIFICATION")
print("=" * 60)
print(f"\nFile row counts:")
print(f"  campaigns.csv:          {len(campaigns)} rows")
print(f"  ads.csv:                {len(ads)} rows")
print(f"  breakdowns.csv:         {len(breakdowns)} rows")
print(f"  breakdown_age_gender:   {len(age_break)} rows")

# ---------- SPEND / KPIs ----------
print("\n" + "=" * 60)
print("KPI METRICS (from campaigns.csv)")
print("=" * 60)

total_spend = sum(to_num(field(c, 'Amount spent (USD)', 'Amount Spent (USD)')) or 0 for c in campaigns)
print(f"\nTotal Spend (all-time):   ${total_spend:,.2f}")

# Leads — no Objective column in this CSV, so check result_indicator
lead_results = []
traffic_results = []
for c in campaigns:
    ri = field(c, 'Result indicator', 'Result Indicator').lower()
    r  = to_num(field(c, 'Results', 'Result'))
    if r is None: continue
    if 'lead' in ri or 'conversion' in ri or 'pixel_lead' in ri:
        lead_results.append(r)
    elif 'link_click' in ri:
        traffic_results.append(r)

total_leads_from_campaigns = sum(lead_results)
print(f"Total Leads (campaign-level, result_indicator filter): {int(total_leads_from_campaigns)}")

# Ad-level leads fallback
total_leads_from_ads = sum(to_num(field(a, 'Results', 'Result')) or 0 for a in ads)
print(f"Total Results (ad-level sum, all types): {int(total_leads_from_ads)}")

# Engine uses isLeadObjective on c.objective which is EMPTY → falls back to ads
# So the engine's totalLeads = sum of ALL ad results
print(f"\nEngine totalLeads (ads fallback): {int(total_leads_from_ads)}")
blended_cpl_engine = total_spend / total_leads_from_ads if total_leads_from_ads > 0 else 0
print(f"Engine Blended CPL:       ${blended_cpl_engine:,.2f}")

# Weighted CTR
total_impr = sum(to_num(field(c, 'Impressions')) or 0 for c in campaigns)
weighted_ctr_num = sum(
    (to_num(field(c, 'Impressions')) or 0) * (to_num(field(c, 'CTR (link click-through rate)')) or 0)
    for c in campaigns
)
weighted_ctr = weighted_ctr_num / total_impr if total_impr > 0 else 0
print(f"\nTotal Impressions:        {int(total_impr):,}")
print(f"Weighted CTR:             {weighted_ctr:.4f}%")

# Weighted CPM
weighted_cpm_num = sum(
    (to_num(field(c, 'Impressions')) or 0) * (to_num(field(c, 'CPM (cost per 1,000 impressions) (USD)')) or 0)
    for c in campaigns
)
weighted_cpm = weighted_cpm_num / total_impr if total_impr > 0 else 0
print(f"Weighted CPM:             ${weighted_cpm:.2f}")

# Avg Frequency
total_reach = sum(to_num(field(c, 'Reach')) or 0 for c in campaigns)
freq_acc = sum(
    (to_num(field(c, 'Reach')) or 0) * (to_num(field(c, 'Frequency')) or 0)
    for c in campaigns
)
avg_frequency = freq_acc / total_reach if total_reach > 0 else 0
print(f"Average Frequency:        {avg_frequency:.4f}")
print(f"Total Reach:              {int(total_reach):,}")

# ---------- GEOGRAPHIC BREAKDOWN ----------
print("\n" + "=" * 60)
print("GEOGRAPHIC BREAKDOWN (from breakdowns.csv)")
print("=" * 60)
print(f"\nDMA column header check:")
if breakdowns:
    dma_col = None
    for k in breakdowns[0].keys():
        if 'dma' in k.lower() or 'region' in k.lower():
            dma_col = k
            break
    print(f"  DMA column found: '{dma_col}'")

# Aggregate by DMA region
dma_agg = {}
for row in breakdowns:
    dma = field(row, 'DMA region', 'DMA Region', 'Region').strip()
    if not dma: continue
    spend = to_num(field(row, 'Amount spent (USD)', 'Amount Spent (USD)')) or 0
    results = to_num(field(row, 'Results', 'Result')) or 0
    if dma not in dma_agg:
        dma_agg[dma] = {'spend': 0, 'conversions': 0}
    dma_agg[dma]['spend'] += spend
    dma_agg[dma]['conversions'] += results

print(f"\nDMA regions found (sorted by spend):")
sorted_dmas = sorted(dma_agg.items(), key=lambda x: -x[1]['spend'])
for dma, stats in sorted_dmas:
    cpl = stats['spend'] / stats['conversions'] if stats['conversions'] > 0 else 0
    cpl_str = f"${cpl:.2f} CPL" if stats['conversions'] > 0 else "no leads"
    print(f"  {dma}: ${stats['spend']:,.2f} spend, {int(stats['conversions'])} leads, {cpl_str}")

# ---------- AD PERFORMANCE ----------
print("\n" + "=" * 60)
print("AD PERFORMANCE (from ads.csv)")
print("=" * 60)

ads_with_data = []
for a in ads:
    name = field(a, 'Ad name', 'Ad Name').strip()
    if not name or name.lower() in ('total', 'grand total', 'all campaigns', '—'):
        continue
    spent  = to_num(field(a, 'Amount spent (USD)', 'Amount Spent (USD)')) or 0
    leads  = to_num(field(a, 'Results', 'Result')) or 0
    impr   = to_num(field(a, 'Impressions')) or 0
    ctr    = to_num(field(a, 'CTR (link click-through rate)')) or 0
    cpl    = spent / leads if leads > 0 else 0
    status = field(a, 'Ad delivery', 'Ad Delivery', 'Delivery status').strip()
    quality= field(a, 'Quality ranking').strip()
    eng    = field(a, 'Engagement rate ranking').strip()
    conv   = field(a, 'Conversion rate ranking').strip()
    ads_with_data.append({
        'name': name, 'spent': spent, 'leads': leads,
        'impr': impr, 'ctr': ctr, 'cpl': cpl,
        'status': status, 'quality': quality, 'eng': eng, 'conv': conv
    })

total_ad_spend = sum(a['spent'] for a in ads_with_data)
total_ad_results = sum(a['leads'] for a in ads_with_data)
print(f"\nTotal ad-level spend:     ${total_ad_spend:,.2f}")
print(f"Total ad-level results:   {int(total_ad_results)}")

# Winners: ads with leads, sorted by CPL asc
winners = sorted([a for a in ads_with_data if a['leads'] > 0], key=lambda x: x['cpl'])
print(f"\nTop 5 WINNING ads (lowest CPL):")
for i, a in enumerate(winners[:5], 1):
    print(f"  {i}. {a['name'][:50]}: ${a['cpl']:.2f} CPL, {int(a['leads'])} leads, ${a['spent']:.2f} spend")

# Wasters: high spend, zero leads
wasters = sorted([a for a in ads_with_data if a['leads'] == 0 and a['spent'] > 10], key=lambda x: -x['spent'])
print(f"\nTop 5 WASTING ads (spend, zero leads):")
for i, a in enumerate(wasters[:5], 1):
    print(f"  {i}. {a['name'][:50]}: ${a['spent']:.2f} spend, 0 leads")

# ---------- AGE/GENDER BREAKDOWN ----------
print("\n" + "=" * 60)
print("AGE/GENDER BREAKDOWN (from breakdown_age_gender.csv)")
print("=" * 60)
age_agg = {}
for row in age_break:
    age = field(row, 'Age').strip()
    if not age: continue
    spent = to_num(field(row, 'Amount spent (USD)', 'Amount Spent (USD)')) or 0
    leads = to_num(field(row, 'Leads', 'Results', 'Result')) or 0
    if age not in age_agg:
        age_agg[age] = {'spend': 0, 'leads': 0}
    age_agg[age]['spend'] += spent
    age_agg[age]['leads'] += leads

print(f"\nAge group CPL distribution:")
for age, stats in sorted(age_agg.items()):
    cpl = stats['spend'] / stats['leads'] if stats['leads'] > 0 else 0
    cpl_str = f"${cpl:.2f}" if stats['leads'] > 0 else "—"
    print(f"  {age}: ${stats['spend']:,.2f} spend, {int(stats['leads'])} leads, {cpl_str} CPL")

# ---------- LAST MONTH ----------
print("\n" + "=" * 60)
print("LAST MONTH (Apr 15 – May 14 2026, from campaigns-last-month.csv)")
print("=" * 60)
lm_path = CSV_DIR / 'campaigns-last-month.csv'
if lm_path.exists():
    lm = load_csv(lm_path)
    lm_spend = sum(to_num(field(c, 'Amount spent (USD)', 'Amount Spent (USD)')) or 0 for c in lm)
    lm_impr  = sum(to_num(field(c, 'Impressions')) or 0 for c in lm)
    print(f"  Last-month spend:     ${lm_spend:,.2f}")
    print(f"  Last-month impressions: {int(lm_impr):,}")
else:
    print("  campaigns-last-month.csv not found")

# ---------- SUMMARY JSON ----------
print("\n" + "=" * 60)
print("SUMMARY JSON (for report comparison)")
print("=" * 60)
summary = {
    "total_spend_campaigns": round(total_spend, 2),
    "total_impressions": int(total_impr),
    "total_leads_from_ads": int(total_leads_from_ads),
    "blended_cpl": round(blended_cpl_engine, 2),
    "weighted_ctr_pct": round(weighted_ctr, 4),
    "weighted_cpm": round(weighted_cpm, 2),
    "avg_frequency": round(avg_frequency, 4),
    "dma_regions": [{"dma": k, "spend": round(v['spend'], 2), "leads": int(v['conversions'])}
                    for k, v in sorted_dmas],
    "top_5_winners": [{"name": a['name'], "cpl": round(a['cpl'], 2), "leads": int(a['leads'])}
                      for a in winners[:5]],
    "top_5_wasters": [{"name": a['name'], "spend": round(a['spent'], 2)}
                      for a in wasters[:5]],
}
print(json.dumps(summary, indent=2))
