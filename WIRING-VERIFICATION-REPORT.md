# WIRING VERIFICATION REPORT
## Take Charge Roofing — Meta Ads Forensic Audit

**Generated:** 2026-05-17  
**Data range:** Apr 15 2023 – May 15 2026  
**Client:** Take Charge Roofing (Atlanta, GA roofing company)  
**Branch:** claude/nextjs-live-shell  

---

## 1. AUDIT SCOPE COMPLETED

| Task | Status | Notes |
|------|--------|-------|
| Synthetic data source identified | ✓ Done | `breakdown_dma.csv` was the culprit |
| Engine wired to real CSVs | ✓ Done | Parser fix + CSV replacement |
| Downloads deduplicated | ✓ Done | See dedup log below |
| Real CSVs copied to project | ✓ Done | All 6 real files in place |
| Dashboard verified at localhost:3000 | ✓ Done | Atlanta DMAs, real spend |

---

## 2. SYNTHETIC DATA SOURCE (Task 1)

**Root cause:** `public/csvs/take-charge-roofing/breakdown_dma.csv` (7 data rows) contained hardcoded Florida DMA data:

| DMA | Spend | Leads | CPL |
|-----|-------|-------|-----|
| Miami-Ft. Lauderdale | $6,420.10 | 78 | $82.31 |
| Tampa-St. Petersburg | $5,210.50 | 64 | $81.41 |
| Orlando-Daytona Beach | $4,180.40 | 51 | $81.97 |
| West Palm Beach-Ft. Pierce | $2,740.85 | 22 | $124.58 |
| Fort Myers-Naples | $1,520.20 | 14 | $108.59 |
| Jacksonville | $810.30 | 0 | — |
| Gainesville | $268.40 | 0 | — |

**Secondary synthetic files found and deleted:**
- `adsets.csv` (25 rows) — fake Florida ad sets with "Storm Damage - Conversion 2024" campaigns in Jacksonville, FL
- `breakdown_age_gender.csv` (6 rows) — synthetic age data
- `breakdown_placement.csv` (6 rows) — synthetic placement data

**File that LOOKED real but was misclassified:**  
`breakdowns.csv` (58 rows) was already the real DMA data (Atlanta/Greenville-Spartanburg), but the parser classified it as `adset` because it contained an "Ad set name" column. The geographic analysis never saw it, so the synthetic `breakdown_dma.csv` was the only DMA source.

---

## 3. ENGINE WIRING FIX (Task 2)

### Parser fix — `engine/parsers/metaAdsCsv.ts`

**Problem:** `classify()` returned `{ kind: 'adset' }` when "Ad set name" was present, even if "DMA region" was also present. Meta exports DMA breakdowns at adset-level granularity (both columns appear together), so the real DMA file was never classified as `breakdown/dma`.

**Fix applied (line ~110):**
```typescript
// DMA region is a definitive breakdown signal even when "Ad set name" is present —
// Meta exports DMA breakdowns at adset-level granularity, so both columns appear together.
if (bkHits.includes('dma')) return { kind: 'breakdown', breakdownKind: 'dma' };

if (hasAdsetName) return { kind: 'adset' };
```

**Result:** `breakdowns.csv` now correctly classified as `breakdown/dma`, feeding real Atlanta DMA data into geographic analysis.

### No-data empty state — `app/audit/[client]/page.tsx`

Added an explicit empty state UI when `audit.fileSummary.length === 0`. The dashboard now shows "No data — drop CSVs to populate" instead of a blank zeroed-out dashboard when the folder is empty.

### Anti-synthetic guard

All synthetic CSVs deleted from project. The engine has no fallback to placeholder data — if the CSV folder is empty the empty state renders.

---

## 4. DEDUP LOG (Task 3)

### Set 1: Untitled-report CSVs
| File | MD5 | Size | Action |
|------|-----|------|--------|
| `Untitled-report-Apr-15-2023-to-May-15-2026.csv` | `8ff63ca0` | 10,086 B | **KEPT** (canonical) |
| `Untitled-report-Apr-15-2023-to-May-15-2026 (1).csv` | `8ff63ca0` | 10,086 B | **DELETED** (byte-identical duplicate) |

### Set 2: Campaigns-Apr-15-2023 CSVs
All four files had **different MD5 hashes and sizes** — they are NOT byte-identical duplicates. They are four different Meta Ads Manager breakdown exports, all named "Campaigns" because they were exported from the Campaigns view with different breakdown dimensions:

| File | MD5 | Rows | Type | Action |
|------|-----|------|------|--------|
| `...Campaigns...2026.csv` (no suffix) | `603a4a7a` | 9 | **Campaign-level summary** | DELETED per instructions (data preserved in project) |
| `...Campaigns...2026 (1).csv` | `47b5f545` | 84 | **Placement breakdown** | **KEPT** (most rows = canonical per instructions) |
| `...Campaigns...2026 (2).csv` | `fd2b599f` | 41 | **Age breakdown (no leads cols)** | DELETED (superseded by (3)) |
| `...Campaigns...2026 (3).csv` | `42fb3175` | 41 | **Age breakdown (with leads)** | DELETED (data preserved as `breakdown_age_gender.csv`) |

> ⚠ **Note:** The (1) file (kept as "canonical") is actually a placement breakdown, not a campaign-level summary. The plain campaigns file (8 rows) was copied to the project as `campaigns.csv` **before** deletion because it is the only source of campaign-level spend/CTR/frequency data for the engine's funnel and efficiency analyses.

### Preserved unchanged
| File | Reason |
|------|--------|
| `Take-Charge-Roofing-Ads-Apr-15-2023-May-15-2026.csv` | Unique, ads data |
| `Take-Charge-Roofing-Campaigns-Apr-15-2026-May-14-2026.csv` | Different date range (last month only) |
| `SNA_Marketing_TakeCharge_Audit.pdf` | Not a CSV — untouched |
| `Interactive_Forensic_Audit` (HTML) | Not a CSV — untouched |

---

## 5. PROJECT CSV FILES (Task 4)

```
public/csvs/take-charge-roofing/
├── campaigns.csv               (8 rows)   campaign-level, Apr 2023 – May 2026
├── ads.csv                     (60 rows)  ad-level performance
├── breakdowns.csv              (58 rows)  DMA breakdown (adset × DMA region)
├── breakdown_age_gender.csv    (40 rows)  age × campaign breakdown
├── breakdown_placement.csv     (83 rows)  platform × placement breakdown
├── reference/
│   └── campaigns-last-month.csv (8 rows) Apr 15–May 14 2026 only — NOT auto-parsed
│                                          (kept in reference/ to prevent double-counting
│                                           the last month in all-time metrics)
└── README.md
```

**Parser classification confirmed from live server:**
```json
{
  "ads.csv": "ad (60 rows)",
  "breakdowns.csv": "breakdown/dma (58 rows)",
  "breakdown_age_gender.csv": "breakdown/age_gender (40 rows)",
  "breakdown_placement.csv": "breakdown/placement (83 rows)",
  "campaigns.csv": "campaign (8 rows)"
}
```

---

## 6. METRIC VERIFICATION (Task 5)

All values computed independently from raw CSVs via `verify_metrics.mjs` and cross-referenced against the live dashboard at `http://localhost:3000/audit/take-charge-roofing`.

### Core KPIs

| Metric | CSV Calculation | Dashboard | Match |
|--------|----------------|-----------|-------|
| Total Spend (all-time) | $3,137.11 | $3,137.11 | ✓ |
| Total Impressions | 78,601 | 78,601 | ✓ |
| Total Reach | 58,440 | — | — |
| Avg Frequency | 1.7514 | — | — |
| Weighted CPM | $39.91 | — | — |
| Lead Volume (engine) | 988 | 988 | ✓ |
| Blended CPL (engine) | $3.18 | $3.18 | ✓ |

> ⚠ **CPL data quality warning:** The engine's "Blended CPL" of **$3.18** is computed as total_spend / total_ad_results = $3,137.11 / 988. This 988 includes **957 traffic link-clicks** from the "Traffic Ad", "SM Traffic Ad 1", and "LP Traffic Ad 1" ad types — which are link-click results, not roofing leads. The **actual lead CPL** from true lead-generation campaigns is $3,137.11 / 31 = **$101.07**, which aligns far better with the geographic CPL of $102.37 per DMA breakdown row. The campaign-level CSV lacks an "Objective" column; the engine can't distinguish lead objectives from traffic objectives, so it falls back to all ad results. Target benchmark is $65 — this account is over-benchmark on real leads.

### Last Month (Apr 15 – May 14 2026)

| Metric | CSV Calculation | Dashboard | Match |
|--------|----------------|-----------|-------|
| Last-month spend | $3,091.76 | — | — |
| Last-month impressions | 77,775 | — | — |
| Last-month lead results | 31 | — | — |

> Note: Last-month data is stored in `reference/campaigns-last-month.csv` and is NOT auto-ingested to prevent double-counting the Apr–May 2026 period (which is already included in the all-time campaigns.csv covering Apr 2023–May 2026).

### Geographic Breakdown — REAL Atlanta DMAs ✓

| DMA Region | CSV Spend | CSV Leads | CSV CPL | Status |
|-----------|-----------|-----------|---------|--------|
| **Atlanta** | $3,070.96 | 30 | $102.37 | HOT |
| **Greenvll-Spart-Ashevll-And** | $21.31 | 0 | — | COLD (leak) |

Dashboard confirms: **Atlanta and Greenville-Spartanburg-Asheville** — **ZERO Florida DMAs**. The synthetic Miami/Tampa/Orlando data is gone.

### Top 5 Winning Ads (lowest CPL with ≥1 lead)

| Rank | Ad Name | CPL | Leads | Spend |
|------|---------|-----|-------|-------|
| 1 | SM Traffic Ad 1 | $0.39 | 525 | $205.00 |
| 2 | LP Traffic Ad 1 | $0.47 | 432 | $204.19 |
| 3 | AD 2 | $5.53 | 1 | $5.53 |
| 4 | AD 2 | $14.59 | 1 | $14.59 |
| 5 | AD 1 | $37.95 | 5 | $189.76 |

> ⚠ Ranks 1–2 are traffic-click ads (link-click objective) — their "leads" are landing page clicks, not form submissions. The real lead-form winners are ranks 3–5.

### Top 5 Wasting Ads (zero leads, high spend)

| Rank | Ad Name | Spend | Leads |
|------|---------|-------|-------|
| 1 | AD 1 | $121.99 | 0 |
| 2 | AD 2 | $70.34 | 0 |
| 3 | AD 1 | $65.39 | 0 |
| 4 | AD 2 | $65.06 | 0 |
| 5 | AD 2 | $64.63 | 0 |

### Age/Gender CPL Distribution

| Age Group | Spend | Leads | CPL |
|-----------|-------|-------|-----|
| 25–34 | $544.37 | 4 | $136.09 |
| 35–44 | $317.40 | 2 | $158.70 |
| 45–54 | $351.21 | 6 | $58.53 |
| 55–64 | $532.32 | 6 | $88.72 |
| 65+ | $1,428.50 | 13 | $109.88 |

Best CPL: **45–54** at $58.53. Most spend: **65+** at $1,428.50 (13 leads).

### Funnel Retention

| Stage | Count | Retention |
|-------|-------|-----------|
| Impressions | 78,601 | 100% |
| Clicks | ~1,613 (est.) | ~2.05% CTR |
| Estimated Sessions | ~1,371 | ~85% |
| Tracked Leads | 31 (form) / 988 (all results) | — |

---

## 7. WHAT CHANGED

| Component | Before | After |
|-----------|--------|-------|
| `breakdown_dma.csv` | Synthetic Florida (Miami, Tampa, Orlando, etc.) | **DELETED** |
| `breakdown_age_gender.csv` | Synthetic (6 rows) | Real data (40 rows) |
| `breakdown_placement.csv` | Synthetic (6 rows) | Real data (83 rows) |
| `campaigns.csv` | Age breakdown (mislabeled, 41 rows) | Real campaign-level (8 rows) |
| `adsets.csv` | Synthetic Florida ad sets | **DELETED** |
| `breakdowns.csv` | Real DMA data but misclassified as `adset` | **Parser fixed — now `breakdown/dma`** |
| `ads.csv` | Already real data | No change (was correct) |
| Parser `classify()` | DMA files with "Ad set name" → misclassified as adset | DMA signal beats adset signal |
| `campaigns-last-month.csv` | (didn't exist) | Copied to `reference/` subfolder (not auto-parsed) |

---

## 8. KNOWN LIMITATIONS

1. **CPL reported as $3.18** — This is misleading. The campaigns.csv has no "Objective" column so the engine can't identify lead campaigns and falls back to `sum(ads.results)` which includes 957 traffic link-clicks. Real lead CPL = **$101.07** (31 leads from result_indicator filter on campaigns).

2. **Ad names not unique** — Multiple ads named "AD 1" and "AD 2" across different campaigns. The creative analysis deduplicates by ad name, which may merge different ads with the same name.

3. **Short date range** — All data is from Apr 15–May 15 2026 (the last month). The CSV filename says "Apr 15 2023" but the actual data rows only go back to Apr 15 2026 based on the `Reporting starts` column values.

4. **campaigns-last-month.csv in reference/** — The last-month breakdown is preserved for reference but not auto-ingested. To compare month-over-month, it would need to be ingested separately (e.g., via a dedicated route or CLI flag).

---

## 9. CPL / CPC SPLIT FIX (2026-05-20)

**Branch:** `claude/cpl-fix-and-real-pdf`

The engine previously produced two competing numbers labelled "CPL":
- **~$3.18** when `spendEfficiency.analyzeSpendEfficiency` fell back to
  `sum(ads.results)` — which for a Traffic-objective account is *link
  clicks*, not lead-form submissions. This was a click-based CPL
  masquerading as CPL.
- **~$101.07** when leads were filtered through `isLeadObjective(...)` (the
  honest, Meta-Ads-Manager-equivalent number).

### What changed

`engine/analyses/spendEfficiency.ts`
- Renamed the click-based fallback away — it is now the **`weightedCpc`**
  field, computed strictly as `totalSpend / totalLinkClicks`, where clicks
  are derived from `impressions × CTR / 100`.
- `blendedCpl` is now strictly `totalSpend / totalLeads`, where
  `totalLeads` comes only from lead-objective campaigns (Meta's
  Results column when Objective = Leads). There is no fallback to
  ad-level Results (which conflates clicks with leads). If no
  lead-objective campaign exists, CPL is reported as `—` and the cost
  story is carried entirely by CPC. `leadObjectiveSpend` (the per-
  objective slice) is still exposed as a separate result field.
- Added new KPI card `Control_CPC` so CPC has a first-class place in the
  KPI snapshot alongside the CPL card.
- New result fields: `totalClicks`, `leadObjectiveSpend`, `weightedCpc`.

`engine/analyses/creativeAnalysis.ts`
- Added `cpc` per ad (parser column, or derived from `impressions × CTR`).
- Added `blendedCpc` to `CreativeAnalysisResult`.
- `blendedCpl` is now only emitted when ≥1 converter ad exists, so we
  never publish a "CPL" that is really a per-click average.

`engine/analyses/geographicWaste.ts`
- Header comment now states that `cpl` per region is literally
  `spend / Results` — true cost-per-lead only when the campaign was a
  Leads-objective campaign. Dashboard relabels the column to `CPC`
  for click-based accounts.

`engine/index.ts` (CLI summary)
- Prints both Blended CPL and Blended CPC with their methodology notes.

`app/components/audit/KPISnapshot.tsx`
- Added `Control_CPC` to display-label maps.

`app/components/audit/AuditRibbon.tsx`
- CPL chip hidden when no lead-objective campaigns ran; CPC chip is
  added and always shown when clicks exist.

`app/components/audit/CreativeAnalysisGrid.tsx`
- Per-ad card shows CPL when leads exist; otherwise shows CPC.

`app/components/audit/GeographicHeatmap.tsx`
- New `costMetricLabel?: "CPL" | "CPC"` prop. Column header switches to
  `CPC` for click-only accounts.

`app/audit/[client]/AuditDashboard.tsx`
- Passes `costMetricLabel` to GeographicHeatmap based on
  `audit.spend.blendedCpl > 0`.
- New methodology footnote under the KPI snapshot:
  *"CPL is computed as total ad spend divided by lead-form submissions
  (Meta's 'Results' column for Leads-objective campaigns). For
  Traffic-objective campaigns, CPC (cost per click) is shown instead.
  Mixed-objective accounts use a weighted blend, documented per row."*

### Result for Take Charge audit

Engine output verified on `public/csvs/take-charge-roofing`:

```
  Total Spend:       $3137.11
  Tracked Leads:     31
  Blended CPL:       $101.20  (total spend / lead form submissions)
  Blended CPC:       $1.94    (total spend / link clicks)
  Weighted CTR:      2.05%
```

The headline CPL is the honest $101.20 figure (matches Meta's
"cost per lead" mental model). CPC of $1.94 is exposed separately
for transparency and decision-making on the Traffic campaigns. The
$3.18 conflated number is gone — the two metrics are never displayed
under the same label again.

---

## 10. REAL PDF EXPORT (2026-05-20)

Replaced the static `SNA_Marketing_TakeCharge_Audit.pdf` link with a
real, on-demand Puppeteer-driven export.

### What changed

- **New API route:** `app/api/audit/[client]/pdf/route.ts` — server-side
  Puppeteer that fetches `/audit/[client]?print=true`, waits for network
  idle plus a 2 s render buffer, then `page.pdf()` with Letter format
  and 20 px margins. Returns `application/pdf` with a
  `Content-Disposition: attachment` header.
- **Environment-aware Chromium:** local dev uses bundled Puppeteer;
  production / Vercel uses `@sparticuz/chromium-min` (~50 MB slim
  build) via `puppeteer-core`.
- **Print mode:** `/audit/[client]?print=true` hides the sidebar,
  controls panel, header buttons, ribbon, and what-if banner. Adds
  `print-mode` body class with section page-break hints, slightly
  taller card padding, and animations disabled.
- **Button wiring:** the sidebar "Download PDF Report" link now points
  at `/api/audit/[client]/pdf`; the frozen static PDF in `public/` was
  deleted (3.7 MB freed).
