# Tier 2.5 (rebuilt clean) — Bug Hunt and Fix

Branch: `claude/tier-2-5-rebuilt-clean`
Base: `f5db0c2` (current `main` HEAD: merge of Tier 1 + Tier 2)
Author: Lester <leso343@users.noreply.github.com>

This pass rebuilds the original Tier-2.5 work as a clean, conflict-free
branch on top of the already-merged `main` (Tier 1 + Tier 2). Two of the
original Tier-2.5 findings (demographics-uses-Leads and creative-dedup
grouping) were already addressed by Tier 2's merge; those are *not*
re-applied here. Everything else is reimplemented from scratch by
reading the current code and reapplying the same fix pattern.

---

## Reconciliation result for take-charge-roofing

| Metric                          | Engine output | Target     | Pass |
| ------------------------------- | ------------- | ---------- | ---- |
| Total spend                     | $3,137.11     | $3,137.11  | yes  |
| Total leads                     | 31            | 31         | yes  |
| Age leads sum                   | 31            | 31         | yes  |
| Creative unique ads (totalAds)  | 14            | 14         | yes  |
| Creative blended CPL            | $103.07       | ≈ $101.20  | yes (gated) |
| Tracking: lead campaigns found  | 7             | > 0        | yes  |
| Tracking: broken lead campaigns | 1             | ≥ 1        | yes  |

`npm run build` is clean — no warnings, no type errors. `npx tsc --noEmit`
is silent. Account-wide spend/leads are byte-identical to `main`; only
metrics that were previously corrupted by mixed-objective Results
contamination move.

---

## Bugs fixed (file:line — what was wrong → fix)

### 1. `engine/parsers/metaAdsCsv.ts:34` — `toNumber` ate every comma
The currency-stripper char class `/[\$,€£¥]/g` silently stripped ALL commas,
including decimal commas (European format `"1,2"` → `12`) and stray commas
inside malformed cells. The thousand-separator lookahead a few characters
later (`/,(?=\d{3}\b)/g`) was then dead code for any value the first regex
already touched.
**Fix:** scoped the first pass to actual currency symbols only
(`/[\$€£¥]/g`); the thousands-comma regex is now the sole place commas are
removed. Commit `85b4f49`.

### 2. `engine/types/index.ts:90-105` + `engine/parsers/metaAdsCsv.ts:236-244` — `BreakdownRow` was missing fields downstream analyses needed
`BreakdownRow` had no `leads`, `linkClicks`, or `resultIndicator` fields.
Meta age/gender exports include all three; without them downstream analyses
could not tell a "Results = 561 link clicks" row from a "Results = 2 leads"
row.
**Fix:** added the fields to the type and populated them in `mapBreakdown`
(with the common header aliases — `Leads` / `Website leads` / `Meta leads`,
`Link clicks` / `Link Clicks`, etc.). Commit `85b4f49`.

### 3. `engine/analyses/trackingFailures.ts:30-44` — `isLeadObjective` ignored Result indicator and campaign name
`campaigns.csv` from Meta routinely ships with an empty Objective column.
The local `isLeadObjective(o)` only matched on Objective, so **zero
campaigns ever got classified as lead campaigns**, which meant the entire
"broken lead pixel" detector was dead. The same predicate in `funnelLeakage`
and `spendEfficiency` already had the indicator-based fallback.
**Fix:** added the indicator-fallback here too, plus a third fallback on
campaign name (`^LF\b`, `^Lead\b`, `^Lead Form`, `^Lead Generation`) — this
catches the broken-tracking case where Objective AND Result indicator are
BOTH empty, Results is 0, but the campaign spent money. After the fix:
take-charge-roofing's "Lead Forms" campaign (empty objective, empty
indicator, zero results, $150.61 spend) is correctly flagged. Total lead
campaigns detected goes 0 → 7; broken lead campaigns goes 0 → 1. Commit
`14b2ccd`.

### 4. `engine/analyses/creativeAnalysis.ts:18-26, 51-92, 158-167` — `blendedCpl` counted link clicks as leads
Tier 2's creative-grouping aggregator summed every row's Results into
`totalResults`, then derived `blendedCpl` from `totalSpend / totalResults`.
For take-charge-roofing the "Traffic Ad" campaign reports 947 link clicks
in its Results column, which collapsed the account-wide blended CPL from a
real ~$101 down to a fake **$3.23** and made wasters look like winners.
**Fix:** introduced an `isLeadIndicator()` helper, added a parallel
`leadResults` counter on the per-ad aggregator, and switched `blendedCpl`
to divide by `totalLeadResults`. The per-ad `results` / `cpl` are left
unchanged (so the winner/waster ranking surfaces real converters); only
the account-wide blended number is gated. Verified: 3.23 → 103.07 while
account spend / total leads (3137.11 / 31) are unchanged. Commit `41cfa30`.

### 5. `app/components/audit/ReportViewer.tsx:157` (+ `app/context/ReportContext.tsx` + `app/audit/[client]/AuditDashboard.tsx`) — hardcoded TakeCharge PDF URL
The Download-PDF link in `ReportViewer` pointed at
`/SNA_Marketing_TakeCharge_Audit.pdf` regardless of which client's audit
was open. For every client other than take-charge-roofing it 404'd; for
any future client added it would download the Take Charge report.
**Fix:** thread the per-client PDF URL through the report context.
`ReportViewer` now accepts a `pdfPath` prop and uses it for the anchor;
the whole link is hidden when no `pdfPath` is supplied. `ReportProvider`
accepts and forwards it. `AuditDashboard` already computed
`pdfPath = /api/audit/${clientSlug}/pdf` (the per-client Puppeteer route
from Tier 1) — it now passes that into `<ReportProvider>` so the in-report
download button matches the sidebar's. Commit `fa92606`.

### 6. `app/components/audit/CreativeAnalysisGrid.tsx:33, 81` — `liveCpl` truthiness guard was too loose
`liveCpl && ad.cpl > 0` relies on JS truthiness — which is correct for 0
but also accepts NaN as a falsy value, silently swallowing the bug
instead of surfacing it. Worse, the header check
`{liveCpl && (…)}` renders a literal `"0"` on the page when `liveCpl === 0`
(the classic React-conditional gotcha). Reachable via `?cpl=0` or
`?cpl=foo` (which produced NaN before bug #7 below).
**Fix:** explicit `liveCpl != null && liveCpl > 0` guards on both sites.
The badge math `(ad.cpl / liveCpl - 1) * 100` is now unreachable for
`liveCpl=0`, and no header strings render "0 CPL target". Commit `aa0f25a`.

### 7. `app/audit/[client]/page.tsx:65-83` — NaN query-string poison
`Number(search.cpl)` returned `NaN` for any malformed query value
(`?cpl=foo`). NaN silently propagated into every downstream benchmark
comparison, where `blendedCpl > targetCpl` and `blendedCpl < targetCpl`
are BOTH false — so benchmark status flipped to "passing" green badges
across the board. Similarly `?cpl=0` produced a 0 target that then
divided into Infinity in the live-tag math (bug #6).
**Fix:** introduced `parsePosNum()` and `parsePosInt()` helpers that
return the fallback for `undefined` / empty / non-finite / non-positive
(and for `days`, non-integer) values. Clean URLs behave identically;
malformed ones now fall back to the industry default instead of
poisoning everything downstream. Commit `4a8f35f`.

---

## Things that LOOKED like bugs but were already fixed

- **`engine/analyses/demographics.ts` — using `Leads` instead of `Results`.**
  Already in `main` from Tier 2 (commit `b541fa7`). Tier 2's approach
  reads `raw['Leads']` directly when the column is present; this branch
  exposes the same data through the `BreakdownRow.leads` field for any
  future analyses that want a typed accessor, but does not touch
  `demographics.ts`.

- **`engine/analyses/creativeAnalysis.ts` — grouping duplicate ad rows by
  Ad name.** Already in `main` from Tier 2 (commit `d8d24af`). Tier 2's
  keying is `${campaignName} :: ${adName}` (slightly different from the
  original Tier-2.5 patch's `adName` alone, but unique-ad count is the
  same for take-charge-roofing: 14). This branch leaves the grouping
  alone and only adds the lead-indicator gate to `blendedCpl` (bug #4).

- **`AuditDashboard.tsx` hardcoded PDF.** Already replaced in `main`
  with the dynamic `/api/audit/${clientSlug}/pdf` path (Tier 1, commit
  `825f4d7`). The only remaining hardcoded link was in
  `ReportViewer.tsx`, which is the fix in bug #5 above.

- **`BreakdownRow` missing fields — TS errors from `npx tsc --noEmit`.**
  Type-checker was already silent on `main`; the missing fields didn't
  surface as TS errors because nothing in `main` referenced them yet.
  They are added in this branch as a deliberate API surface for the new
  bugs #4 (creativeAnalysis indicator gate) — and they happen to match
  what a future Tier-3 demographics-by-Leads analyzer could consume too.

---

## Verification commands

```sh
# Reconciliation
npx tsx -e "import {runAudit} from './engine/runAudit'; \
  const r = runAudit({csvDir:'./public/csvs/take-charge-roofing', clientName:'Take Charge Roofing'}); \
  console.log('spend:', r.spend.totalSpend, 'leads:', r.spend.totalLeads); \
  console.log('age leads:', r.demographics.brackets.reduce((s,b)=>s+b.leads,0)); \
  console.log('blended cpl:', r.creative.blendedCpl); \
  console.log('lead campaigns:', r.tracking.totalLeadCampaigns, 'broken:', r.tracking.brokenLeadCampaigns);"
# Expected: spend: 3137.11 leads: 31, age leads: 31, blended cpl: 103.07,
#           lead campaigns: 7, broken: 1.

# Build
npm run build  # clean

# Typecheck
npx tsc --noEmit  # silent
```
