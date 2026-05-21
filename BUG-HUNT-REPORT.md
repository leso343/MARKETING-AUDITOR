# Tier 2.5 — Bug Hunt and Fix

Branch: `claude/tier-2-5-bug-hunt-and-fix`
Base: `8db3867` (main HEAD: "UI polish: dark/light toggle, auto-hide scrollbar, logo centering")
Author: Lester <leso343@users.noreply.github.com>

This pass started from `main` because the `tier-2-visualizers-and-copy.bundle`
was not accessible in the sandbox. The two Tier-2 engine fixes the brief calls
out (group creatives by `Ad name`; use `Leads` not `Results` in age/gender)
were therefore reproduced here from scratch, alongside everything else found.

---

## Reconciliation result for take-charge-roofing

| Metric         | Engine output | Target     | Pass |
| -------------- | ------------- | ---------- | ---- |
| Total spend    | $3,137.11     | $3,137.11  | yes  |
| Total leads    | 31            | 31         | yes  |
| Blended CPL    | $101.20       | (derived)  | yes  |
| Age leads sum  | 31            | 31         | yes  |

`npm run build` is clean — no warnings, no type errors.

---

## Bugs fixed (file:line — what was wrong → fix)

### 1. `engine/parsers/metaAdsCsv.ts:35` — currency-stripper ate every comma
The `toNumber` helper used `s.replace(/[\$,€£¥]/g, '')` which silently stripped
ALL commas, including decimal commas (European format) and stray commas inside
malformed cells (e.g. `"1,2"` became `12`). The lookahead-only second pass
(`/,(?=\d{3}\b)/g`) was then dead code. **Fix:** scoped the first char class
to currency symbols only (`/[\$€£¥]/g`); the thousands-comma regex is now the
sole place commas are removed.

### 2. `engine/parsers/metaAdsCsv.ts` (mapBreakdown) + `engine/types/index.ts` — Leads column wasn't captured
`BreakdownRow` had no `leads`, `linkClicks`, or `resultIndicator` fields. Meta
age/gender exports include all three; without them downstream analyses could
not tell a "Results = 561 link clicks" row from a "Results = 2 leads" row.
**Fix:** added the fields to the type and populated them in `mapBreakdown`.

### 3. `engine/analyses/demographics.ts:32-39` — Tier-2 fix: use `Leads`, not `Results`
The age aggregator summed `r.results` for each age row. For `take-charge-roofing`,
this gave **565 leads in the 25-34 bracket** (because the "Traffic Ad" campaign
reports its 561 link clicks in `Results`). The dashboard reported a $0.96 CPL
for that bracket — pure noise. **Fix:** prefer the dedicated `Leads` column;
fall back to `Results` only when `Result indicator` is a lead-shaped event
(`leadgen`, `fb_pixel_lead`, `onsite_conversion.lead`). After the fix age
leads sum to 31, matching the canonical total.

### 4. `engine/analyses/creativeAnalysis.ts` — Tier-2 fix: group by `Ad name` before ranking
Meta ad-level exports repeat the same creative once per ad set. Without
grouping, "AD 2" appeared 17 times in the rankings — both as a winner and a
waster depending on which ad set the row came from. **Fix:** aggregate spend,
impressions, leads, reach, and ctr/frequency (weighted) by `Ad name` before
running the winners/wasters logic. `totalAds` is now the unique-ad count
(14 for take-charge-roofing) rather than the row count (60).

### 5. `engine/analyses/creativeAnalysis.ts` — counted link clicks as leads
The grouped aggregator only counts a row's `Results` toward leads when its
`Result indicator` is a lead event. Previously the Traffic Ad's 947 link
clicks flowed into `blendedCpl` and produced a $3.23 blended CPL across the
account. **Fix:** `isLeadIndicator` gate.

### 6. `engine/analyses/trackingFailures.ts:30` — `isLeadObjective` ignored Result indicator
`campaigns.csv` from Meta typically ships with an empty `Objective` column.
The local `isLeadObjective` only matched on Objective, so **zero campaigns
were ever classified as lead campaigns**, which meant the entire
"broken lead pixel" detector was dead. The same function in `funnelLeakage`
and `spendEfficiency` already had the indicator-fallback. **Fix:** same
fallback here (lead-shaped Result indicator), plus a third fallback on
campaign name (`^LF\b`, `^Lead\b`, etc.) — this catches the exact case in
take-charge-roofing where "Lead Forms" has empty objective, empty indicator,
zero results, and $150.61 in spend (textbook broken tracking).

### 7. `app/audit/[client]/AuditDashboard.tsx:120` + `app/components/audit/ReportViewer.tsx` + `Sidebar.tsx` — hardcoded TakeCharge PDF URL
Every client's dashboard linked to `/SNA_Marketing_TakeCharge_Audit.pdf`. For
take-charge-roofing it happened to work; for every other client it 404'd, and
for any future client it would download the wrong report. **Fix:** resolve the
PDF on the server side from one of four candidate paths (`<csvDir>/report.pdf`,
`<csvDir>/<slug>.pdf`, `/public/<slug>-audit.pdf`, `/public/<slug>.pdf`) and
thread the result through `pdfPath` props. The link is hidden when no file
exists.

### 8. `app/components/audit/CreativeAnalysisGrid.tsx:84` — divide-by-zero on liveCpl=0
`((ad.cpl / liveCpl - 1) * 100).toFixed(0)` produced `Infinity` if `liveCpl`
was zero (reachable via `?cpl=0` or `?cpl=foo` before bug 9 below). **Fix:**
guard `liveCpl != null && liveCpl > 0` before computing the badge.

### 9. `app/audit/[client]/page.tsx:65-72` — NaN query-string poison
`Number(search.cpl)` returned `NaN` for any malformed query value, which then
silently propagated into every benchmark comparison (NaN > x is always false,
so all "passing" badges turned green). **Fix:** introduced a `parseNum`
guard that rejects non-finite / non-positive values and falls back to the
industry default.

---

## Things that LOOKED like bugs but aren't

- **DMA breakdown only shows 2 zones (Atlanta + Greenvll-Spart-Ashevll-And).**
  That is what the raw CSV contains; not a bug.
- **`breakdowns.csv` spend ($3,092.27) ≠ `campaigns.csv` spend ($3,137.11).**
  $44.84 of campaign spend is not attributed to any DMA in the breakdown
  export. This is a Meta export artifact (rows with empty DMA region), not an
  engine bug.
- **PDF API route.** The brief asked about dev/prod branching in a PDF route;
  no such route exists in this codebase. PDF generation is purely
  `window.print()`-driven via the iframe. Nothing to fix.

---

## Verification commands

```sh
# Reconciliation
npx tsx -e "import {runAudit} from './engine/runAudit'; \
  const r = runAudit({csvDir:'./public/csvs/take-charge-roofing', clientName:'Take Charge Roofing'}); \
  console.log('spend:', r.spend.totalSpend, 'leads:', r.spend.totalLeads); \
  console.log('age leads:', r.demographics.brackets.reduce((s,b)=>s+b.leads,0));"
# Expected: spend: 3137.11 leads: 31, age leads: 31

# Build
npm run build  # clean

# Typecheck
npx tsc --noEmit  # silent
```

