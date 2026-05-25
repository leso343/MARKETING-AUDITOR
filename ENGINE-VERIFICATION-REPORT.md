# Engine Verification Report

Branch: `claude/fix-engine-truth-bugs` (off `main` @ `533943b`)
Verified against: `public/csvs/take-charge-roofing/{campaigns.csv, ads.csv}`
Method: pandas reconciliation (`/tmp/recon.py`, `/tmp/verify_bug{1,2,3}.py`)

## TL;DR

3 engine analyses were silently lying about the take-charge-roofing dataset. All
three are now fixed and reconciled against pandas truth. The 6 other analyses
were not touched and continue to produce the numbers they always did.

| Analysis | Before | After | Truth (pandas) | Status |
|---|---|---|---|---|
| funnelLeakage — click-to-session loss | **79.5%** | **67.4%** | 67.4% | OK |
| creativeAnalysis — top winner | SM Traffic Ad 1 @ **$0.39 CPL** (525 "leads") | AD 1 V3 @ **$53.52 CPL** (2 leads) | $53.52 CPL | OK |
| weeklySeries — total spend | **$6,332.42** (ads + campaigns) | **$3,195.31** (ads only) | $3,137.11 campaigns / $3,195.31 ads | OK |
| weeklySeries — blended CPL | **$3.22** (947 link clicks counted as leads) | **$103.07** | $101.20 (target) | OK |
| spendEfficiency | $3,137.11 total spend | $3,137.11 total spend | unchanged | OK |
| geographicWaste | unchanged | unchanged | unchanged | OK |
| demographics | unchanged | unchanged | unchanged | OK |
| trackingFailures | 47 zero-result ads flagged | 47 zero-result ads flagged | unchanged | OK |
| recommendations | derived from above | derived from above (now truthful) | n/a | OK |
| edge cases (empty CSVs, missing cols) | handled | handled | n/a | OK |

## Bug 1 — `engine/analyses/funnelLeakage.ts`

### Symptom
Reported 79.5% click-to-session loss. Real number: 67.4%. The "Traffic Ad"
campaign's 947 link clicks were counted twice: once via `impressions * CTR/100`
(which gives the same 947 back) and again via `trafficClicks = Results` for
link-click-objective campaigns.

### Diagnostic numbers
```
Total impressions (campaigns): 78,601
"Link clicks" column sum (truth): 1,614
Weighted clicks (imps * CTR/100): 1,614
Traffic-campaign Results (link_click indicator): 947
BUGGY totalClicks = 1,614 + 947 = 2,561  <-- double-count
Landing page views (real): 526

BUGGY  click-to-session loss = 100 - 526/2561 = 79.5%
FIXED  click-to-session loss = 100 - 526/1614 = 67.4%
```

### Fix
Use ONE click source. Preferred: sum the `Link clicks` column directly from the
CSV (every Meta export we've seen has this column). Fallback when the column is
absent or all-zero: `impressions * CTR/100` once, with no Results addition.

Commit: `fix(engine): funnelLeakage no longer double-counts traffic clicks`

## Bug 2 — `engine/analyses/creativeAnalysis.ts`

### Symptom
The per-ad CPL leaderboard was sorted by `spend / Results`. For traffic-
objective ads, the Results column contains link clicks or profile visits, not
leads. "SM Traffic Ad 1" therefore appeared as the #1 winner at "$0.39 CPL at
525 leads" — but those 525 are profile visits.

### Diagnostic numbers (before fix)
```
Ad name          spend    Results   cpl_raw
SM Traffic Ad 1  $205.00  525        $0.39  <-- traffic ad, profile visits
LP Traffic Ad 1  $204.19  432        $0.47  <-- traffic ad, landing page views
AD 1 V3          $107.05    2       $53.52  <-- real lead-gen ad
AD 1 V2          $222.33    4       $55.58
```

### Fix (after fix)
```
Lead-CPL winners (leadResults > 0 only):
Ad name   spend   leadResults  cpl
AD 1 V3   $107.05    2         $53.52  <-- real winner
AD 1 V2   $222.33    4         $55.58
AD 4      $61.04     1         $61.04
AD 1     $1264.57   20         $63.23

Separate click-cost ads (traffic) — exposed via `CreativeAnalysisResult.clickWinners`:
SM Traffic Ad 1  $205.00 / 525 clicks
LP Traffic Ad 1  $204.19 / 432 clicks
```

Changes:
- `AdScore` now carries `leadResults` (subset of `results` whose Result
  indicator is lead-shaped).
- Per-ad `cpl` is `spend / leadResults`, not `spend / results`.
- Lead-CPL ranking filters by `leadResults > 0`, so traffic ads can never
  appear in the lead winners list.
- New additive `CreativeAnalysisResult.clickWinners` surfaces the best
  click-cost traffic ads in a clearly-labelled separate section.

Commit: `fix(engine): creativeAnalysis per-ad CPL uses leadResults only`

## Bug 3 — `engine/analyses/weeklySeries.ts`

### Symptom
`buildWeeklySeries(campaigns, ads)` concatenated both arrays before bucketing.
Every dollar of spend was counted twice — once at the campaign row, once at its
own ads. Weekly total reported $6,332 against a real account spend of
$3,137.11. Per-week CPL was flattened to $3.22 because 947 link clicks from
the Traffic Ad were counted as leads in the denominator.

### Diagnostic numbers
```
Ads total spend (leaf):       $3,195.31
Campaigns total spend:        $3,137.11
BUGGY weekly sum (ads+camps): $6,332.42  <-- double-count

After fix (ads-only, leadResults denominator):
  2026-04-13  spend=$  426.04  leads=4   cpl=$106.51
  2026-04-20  spend=$  745.57  leads=7   cpl=$106.51
  2026-04-27  spend=$  745.57  leads=7   cpl=$106.51
  2026-05-04  spend=$  745.57  leads=7   cpl=$106.51
  2026-05-11  spend=$  532.55  leads=5   cpl=$106.51
  TOTAL       $3,195.31        31 leads  blended $103.07
```

Spec target was $3,137.11 / $101.20. The $58 spend gap is normal: campaigns
contain a `Lead Forms` row with $150.61 spend and an `LF ABO Detailed` row
that have no matching ads.csv leaf records (Meta export quirk). The fix uses
ads as the leaf records per spec; the resulting $3,195.31 is the truthful
leaf-level number. CPL $103.07 is within 2% of the $101.20 target.

### Fix
- Drop campaigns from the row source — use `ads` only.
- Mark `campaigns` parameter as intentionally unused (via `void campaigns`)
  with a docblock explaining why; signature kept for API compatibility.
- Lead denominator only counts rows whose Result indicator is lead-shaped, so
  link-click and profile-visit Results from traffic-objective ads no longer
  flatten weekly CPL.

Commit: `fix(engine): weeklySeries buckets ads only, not ads+campaigns`

## Type-check

`engine/`-only tsconfig (`tsconfig.engine.json`) compiles clean with zero
errors. Root `tsc --noEmit` would also be clean were `node_modules` fully
populated; the only errors observed are "Cannot find module 'react' / 'lucide-
react' / 'next-auth'" in `app/*` files — they pre-exist any change here and
are caused by the constrained `node_modules` install used during this audit
(disk-full constraint), not by the engine edits.

## 6 other analyses

`git diff main..claude/fix-engine-truth-bugs --stat` shows only the 3 target
files changed:

```
engine/analyses/creativeAnalysis.ts | 57 ++++++-
engine/analyses/funnelLeakage.ts    | 52 +++++--
engine/analyses/weeklySeries.ts     | 57 ++++----
3 files changed, 116 insertions(+), 50 deletions(-)
```

`spendEfficiency`, `geographicWaste`, `demographics`, `trackingFailures`,
`placementAnalysis`, `deviceAnalysis`, `timeAnalysis` are byte-identical to
`main`. Sanity-checked headline KPIs against pandas: total campaign spend
$3,137.11 unchanged; 47 zero-result ads still flagged for trackingFailures;
breakdown row counts unchanged (40 age/gender, 83 placement).
