# Engine Verification Report

**Branch:** `claude/polish-and-engine-truth`
**Date:** 2026-05-24
**Verifier:** independent pandas reconciliation against `public/csvs/take-charge-roofing/`
**Reference totals (campaigns.csv ground truth):** $3,137.11 spend · 31 leads · $101.20 blended CPL

This report independently computes the expected number for every analysis in `engine/analyses/*.ts`
using pandas on the raw Meta Ads CSV exports, then compares to the engine's actual output.

---

## 1. Numerical reconciliation

### spendEfficiency.ts — ✅ all key totals match

| metric                    | expected (pandas) | engine          | ✅/❌ |
|---------------------------|-------------------|-----------------|------|
| totalSpend                | $3,137.11         | $3,137.11       | ✅   |
| totalLeads                | 31                | 31              | ✅   |
| totalClicks (link clicks) | 1,614             | 1,614           | ✅   |
| leadObjectiveSpend        | $2,730.31*        | $2,579.70       | ⚠️   |
| blendedCpl                | $101.20           | $101.20         | ✅   |
| weightedCpc               | $1.94             | $1.94           | ✅   |
| weightedCtr               | 2.05%             | 2.05%           | ✅   |
| weightedCpm               | $39.91            | $39.91          | ✅   |
| averageFrequency          | 1.75              | 1.75            | ✅   |
| totalImpressions          | 78,601            | 78,601          | ✅   |

\* Difference = $150.61, exactly the spend on the **Lead Forms** campaign whose `Result indicator` is
empty. Pandas (by name) treats it as a lead campaign; the engine (by result indicator) excludes it.
The tracking analysis correctly identifies Lead Forms as the broken pixel campaign, so the engine's
classification is internally consistent — but this discrepancy is worth a code comment.

### funnelLeakage.ts — ❌ DOUBLE-COUNT BUG IN totalClicks

| metric                       | expected (pandas) | engine | ✅/❌ |
|------------------------------|-------------------|--------|------|
| totalImpressions             | 78,601            | 78,601 | ✅   |
| totalClicks                  | **1,614**         | **2,561** | ❌ |
| totalLeads                   | 31                | 31     | ✅   |
| estimatedSessions (LPV col)  | 526               | 526    | ✅   |
| clickToSessionLossPct        | **67.4%**         | **79.5%** | ❌ |
| leakageScore                 | (depends on ↑)    | 79.5   | ❌ (downstream) |

**Bug location:** `engine/analyses/funnelLeakage.ts:50-69`. The traffic-objective `Traffic Ad`
campaign is double-counted:

```ts
// Loop adds weightedClicks for EVERY campaign:
weightedClicks += c.impressions * (c.ctr / 100);      // Traffic Ad: 46389 * 2.04/100 = 947
// Then a second pass adds Results from traffic campaigns:
const trafficClicks = sum(campaigns.filter(...).map(c => c.results));  // Traffic Ad: 947 more
const totalClicks = Math.round(weightedClicks + trafficClicks);        // = 947 + 947 = 1894 for one campaign
```

**Fix:** when accumulating `weightedClicks`, skip campaigns whose `resultIndicator` matches
`/link_click/i` (they're added separately as `trafficClicks`). Or use the `Link clicks` column
directly when available. The right number is 1,614 (the campaign-CSV `Link clicks` total),
which makes click-to-session loss 1 − 526/1614 = **67.4%**, not 79.5%.

### creativeAnalysis.ts — ❌ TRAFFIC ADS RANKED AS LEAD WINNERS

| metric                 | expected (pandas)                | engine                   | ✅/❌ |
|------------------------|----------------------------------|--------------------------|------|
| totalAds (after dedup) | 14                               | 14                       | ✅   |
| totalSpend (ads.csv)   | $3,195.31                        | $3,195.31                | ✅   |
| top winner CPL         | should be lowest **lead** ad      | $0.39 (a traffic ad)     | ❌   |
| top winner "results"   | should be leads only             | 525 link clicks labelled "leads" | ❌ |
| wasters                | AD 2 ($492, 3 leads, CPL $164)   | AD 2 / AD 3 — correct    | ✅   |

**Bug location:** `engine/analyses/creativeAnalysis.ts:155, 184`. The struct tracks `leadResults`
separately for the blended total, but the **per-ad `cpl` field uses raw `results`**, which is
link clicks for traffic ads. So `SM Traffic Ad 1` shows as the #1 winner with
*"Top-quartile CPL of $0.39 at 525 leads. Scale this angle."* — those are 525 **link clicks**.

**Fix:** in the `scored` mapping (line 154), use `cpl = leadResults > 0 ? round(spend / leadResults, 2) : 0`
and filter the `converters` array on `leadResults > 0` instead of `results > 0`. Update the winner
reason string to say "leads" only when the row was actually a lead row.

### geographicWaste.ts — ✅ matches DMA aggregation

| region                      | expected spend | engine spend | expected conv | engine conv | ✅/❌ |
|-----------------------------|----------------|--------------|---------------|-------------|------|
| Atlanta                     | $3,070.96      | $3,070.96    | 30            | 30          | ✅   |
| Greenvll-Spart-Ashevll-And  | $21.31         | $21.31       | 0             | 0           | ✅   |
| **totals**                  | $3,092.27      | $3,092.27    | 30            | 30          | ✅   |
| wasteUSD (cold DMA spend)   | $21.31         | $21.31       | —             | —           | ✅   |

User memory said Greenville should be ~$67 — the actual CSV value is $21.31. **No Florida
placeholder DMAs.** Engine is correct.

### demographics.ts — ✅ matches age aggregation; gender unavailable in source

| bracket | expected leads | engine leads | expected CPL | engine CPL | ✅/❌ |
|---------|---------------|--------------|--------------|------------|------|
| 18-24   | 0 (no rows)   | 0            | —            | —          | ✅   |
| 25-34   | 4             | 4            | $136.09      | $136.09    | ✅   |
| 35-44   | 2             | 2            | $158.70      | $158.70    | ✅   |
| 45-54   | 6             | 6            | $58.54       | $58.54     | ✅   |
| 55-64   | 6             | 6            | $88.72       | $88.72     | ✅   |
| 65+     | 13            | 13           | $109.88      | $109.88    | ✅   |
| **sum** | **31**        | **31**       | —            | —          | ✅   |

**65+ ratio sanity check:** 65+ CPL ($109.88) vs 25-34 CPL ($136.09) → 65+ is 1.24× cheaper.
65+ lead share (13 / 31 = 42%) — bracket carries the account. This is the realistic ratio the
Tier 2.5 fix was supposed to produce; the original SNA 3–4× claim would have been impossible to
support from this data. ✅

**Gender breakdown:** the file is called `breakdown_age_gender.csv` but actually has no Gender
column — only Age. The engine correctly returns `genderBrackets: []` and recommendation
"No gender breakdown data available." Not a bug, but the CSV filename is misleading.

### funnelLeakage — drop-off rates per stage

| stage                      | engine count | engine retention | expected count | ✅/❌ |
|----------------------------|--------------|------------------|----------------|------|
| AD_INTEREST (IMPRESSIONS)  | 78,601       | 100%             | 78,601         | ✅   |
| CLICKS PURCHASED           | 2,561        | 3.26%            | 1,614 (32% lower) | ❌ (see funnel bug) |
| LANDING_PAGE_VIEWS         | 526          | 20.5%            | 526 / 1614 = 32.6% | ✅ count, ❌ retention |
| LEAD_CONVERSION (TRACKED)  | 31           | 5.89%            | 31             | ✅   |

### trackingFailures.ts — ✅ Tier 2.5 fix held

| metric                    | expected | engine | ✅/❌ |
|---------------------------|----------|--------|------|
| totalLeadCampaigns        | 7        | 7      | ✅   |
| brokenLeadCampaigns       | 1 (Lead Forms) | 1 (Lead Forms) | ✅ |
| totalWastedSpend          | $150.61  | $150.61 | ✅  |
| overallScore              | (qualitative) | 50/100 | n/a |

Matches the user's spec exactly: "7 lead campaigns (1 broken)".

### weeklySeries.ts — ❌ DOUBLE-COUNT BUG (campaigns + ads summed together)

| sanity check                  | expected (pandas) | engine sum across weeks | ✅/❌ |
|-------------------------------|-------------------|-------------------------|------|
| Σ weekly spend                | $3,137.11         | **$6,332.40**           | ❌ (2.02×) |
| Σ weekly leads                | 978 (raw Results) | **1,967**               | ❌   |
| Σ weekly verifiedLeads        | 31                | **60**                  | ❌ (~2×) |
| Per-week CPL displayed        | varies            | flat $3.22 every week   | ❌ (meaningless: spend/clicks not spend/leads) |

**Bug location:** `engine/analyses/weeklySeries.ts:64-94`. `buildWeeklySeries(campaigns, ads)`
concatenates both arrays into `all`, then apportions each row's spend/leads into weekly buckets.
Since ad-level rows already sum to (approximately) campaign-level totals, every dollar is counted
twice. The displayed per-week `cpl = spend / leads` therefore divides ~$1,500 of spend by ~459
"leads" (mostly traffic clicks) to get a fake $3.22 CPL — which is roughly 30× lower than the
real blended CPL of $101.20.

**Fix:** in `engine/runAudit.ts:181` and `engine/index.ts`, call `buildWeeklySeries(campaigns, [])`
OR change `buildWeeklySeries` to use ads-only (preferred — more granular). Inside `buildWeeklySeries`,
also change `cpl = spend / verifiedLeads` (not `leads`) so the displayed value is true CPL not
cost-per-result.

### placements / devices / time-of-day

| analysis        | engine output                              | notes |
|-----------------|--------------------------------------------|-------|
| placements      | 14 placements, top-spender FB Reels $1,058, "wasting" | Inherits the same "results = mix of leads + clicks" problem — `cpl` on placements is really cost-per-result. Ads on Facebook Reels shows `$0.28/lead` and is flagged "winner" — those are link clicks. |
| devices         | empty (`[]`)                               | Engine looks for `device` breakdown rows; the CSV has `Device platform` only in `breakdown_placement.csv`. Engine doesn't extract it. Not a regression — just unwired. |
| timeOfDay       | empty                                      | No hourly data in any CSV. Correctly says "no dayparting changes needed." ✅ |

---

## 2. Recommendation grounding (`RecommendationCards.tsx::buildRecos`)

Every recommendation surface in the dashboard is **gated by a real condition on the audit data**.
There are no always-fired recommendations. Each one resolves its headline by interpolating
real numbers from the audit result.

| recommendation key            | gate                              | data-grounded? |
|-------------------------------|-----------------------------------|----------------|
| FUNNEL_CLICK_TO_SESSION_LOSS  | `funnel.clickToSessionLossPct > 30` | ✅ but **input is tainted by funnel double-count bug** — fires at 79.5% when real is 67.4%. |
| LEAD_PIXEL_DISCONNECTED       | iterates `tracking.failures`       | ✅ — only fires for real LEAD_PIXEL_DISCONNECTED failures. |
| WRONG_OPTIMIZATION_EVENT      | iterates `tracking.failures`       | ✅ — only fires when present. |
| ATTRIBUTION_WINDOW_UNSET      | iterates `tracking.failures`       | ✅ — only fires when present. |
| GEO_LEAK_OUT_OF_AREA          | `geo.wasteUSD > 100`              | ✅ — correctly did **not** fire for TCR ($21.31 < $100). |
| CREATIVE_DEAD_WEIGHT          | `creative.wasters.length > 0`     | ✅ but the wasters list itself depends on creativeAnalysis correctness. |
| FREQUENCY_FATIGUE             | `spend.averageFrequency > 2.5`    | ✅ — correctly did **not** fire for TCR (avg 1.75). |

The headline `resolve()` function interpolates the actual values (clickToSessionLossPct, count,
spend, wasteUSD, frequency), not boilerplate. The `impactUSD` field on each card is derived
from real spend numbers, not constants.

**Verdict on recommendations:** the cards are well-grounded — they're not template output that
fires regardless of data. The risk is purely that the **upstream analysis bugs in
funnelLeakage/creativeAnalysis/weeklySeries feed wrong numbers into well-grounded cards**.

---

## 3. Synthetic-data trap check

Repo-wide search for fallbacks:

```
grep -rn "MOCK|FAKE|PLACEHOLDER|SAMPLE_DATA|mockData|fakeData|dummy" \
  --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

Only 2 hits, both safe:
- `app/admin/billing/page.tsx:22` — comment "pull from canonical lib/plans instead of hardcoded values" (already fixed).
- `app/page.tsx:4` — comment about previous hardcoded TCR tile (already DB-driven).

`engine/runAudit.ts:130-200` simply calls every analysis on the parsed data and returns the result.
**No `if (!data) return MOCK_DATA` paths exist.** If the CSVs are empty, the analyses return empty
structures (verified in §4).

---

## 4. Edge case behaviors

| scenario                  | engine response                                                  |
|---------------------------|------------------------------------------------------------------|
| empty CSV directory       | Exits with `[engine] No CSV files found.` and code 1 ✅          |
| malformed CSV (garbage)   | Parses to 0 rows, exits with `No analysable rows after parsing.` ✅ |
| CSV missing required cols | Parses 1 row with zeros, emits all-zero report; no crash, no fake numbers ("Tracked Leads: 0", "Geographic Waste: $0.00") ✅ |
| no DMA breakdown          | `geo.regions = []`, `wasteUSD = 0`, no GEO recommendation fires ✅ |
| no hourly data            | `timeOfDay.hours = []`, recommendation "no dayparting changes needed" ✅ |
| no gender column          | `genderBrackets = []`, recommendation "No gender breakdown data available" ✅ |

The engine fails closed: missing data → zeros and "no data" messaging, not invented numbers.

---

## 5. Overall verdict

**Engine has three specific, mechanically identical bugs** — all stemming from the same
root cause: failing to distinguish lead-objective `Results` (lead-form submissions) from
traffic-objective `Results` (link clicks) when aggregating the same column.

1. **`funnelLeakage.ts` double-counts traffic clicks** → click-to-session loss reads 79.5%
   instead of the real 67.4%. Funnel narrative is overstated.

2. **`creativeAnalysis.ts` ranks traffic ads as lead winners** → "SM Traffic Ad 1" and
   "LP Traffic Ad 1" appear in the winners list with `$0.39/lead` and `$0.47/lead` headlines
   when those are link clicks. A potential customer who runs the audit on their own account
   will see traffic ads ranked above their actual lead-form ads.

3. **`weeklySeries.ts` doubles every weekly aggregate** → weekly spend/leads sums to ~2×
   the truth, and the per-week CPL displayed ($3.22 flat) is ~30× lower than the real
   blended CPL ($101.20). Whatever time-series chart the dashboard renders is wrong.

Everything else is correct: spendEfficiency totals match to the cent, geographicWaste matches
DMA-level aggregation, demographics correctly distributes the 31 leads, trackingFailures
correctly identifies 7 lead campaigns with 1 broken pixel (matching the Tier 2.5 fix spec),
recommendation cards are gated by real conditions and don't fire spuriously, no synthetic
data is ever substituted, and edge cases (empty / malformed / missing columns) all degrade
gracefully without hallucination.

**Pitch-readiness:** the engine is **fundamentally trustworthy on the core money numbers**
($3,137.11 spend, 31 leads, $101.20 CPL, broken-pixel detection, geographic waste, demographic
distribution) — and these are the headline KPIs the dashboard leads with. But three secondary
analyses (funnel %, creative winners list, weekly time-series) contain a systematic
"results-vs-leads" conflation that will surface inflated numbers if a sharp prospect drills in.

**Recommendation:** fix the three bugs above before the pitch. They share a one-paragraph
root cause and can be addressed with localized changes (no schema or data-shape change).
Until then, lead the demo with spend reconciliation, geographic waste, and pixel-disconnection
detection — those are unambiguously correct. Avoid leaning on the funnel-leakage % or the
weekly-CPL line chart as "look how precise we are" demo moments.

**Bottom line:** engine is **trustworthy on the totals, buggy on three secondary aggregations**.
Not "fancy template output" — real math on real data with three identifiable, fixable bugs.
