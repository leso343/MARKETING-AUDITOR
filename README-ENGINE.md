# Blank Page Audits — Dynamic Engine

A real audit engine: ingests Meta Ads Manager CSV exports and renders the
Blank Page Audits dashboard (`interactive_audit.html` aesthetic) with the client's
actual numbers. Replaces hand-typed reports.

---

## Setup

```bash
npm install
npm run build
```

Node 18+ is required.

---

## Get your CSVs

In **Meta Ads Manager**:

1. Select the date range you want to audit.
2. Click **Reports → Export Table Data**.
3. Choose **Excel (.csv)** format.
4. Export each of these views into the same folder:
   - **Campaign view** → `campaigns.csv`
   - **Ad set view** → `adsets.csv`
   - **Ad view** → `ads.csv`
   - **Breakdown by DMA Region** → `breakdown_dma.csv`
   - **Breakdown by Age & Gender** → `breakdown_age_gender.csv`
   - **Breakdown by Placement** → `breakdown_placement.csv`

Drop all CSVs into a per-client folder:

```
./csvs/take-charge-roofing/
  campaigns.csv
  adsets.csv
  ads.csv
  breakdown_dma.csv
  breakdown_age_gender.csv
  breakdown_placement.csv
```

The engine auto-classifies files by inspecting headers, so filenames are
hints — not contracts.

---

## Run

```bash
npm run audit -- \
  --client "Take Charge Roofing" \
  --csv-dir ./csvs/take-charge-roofing \
  --output ./reports/take-charge-roofing.html
```

Optional flags:

- `--target-cpl 55` — your benchmark CPL (default $55)
- `--target-ctr 1.5` — your benchmark CTR % (default 1.5%)

The CLI prints a summary to stdout and exits 0 on success.

---

## Output

A single self-contained `.html` file under `./reports/`. It opens in any
browser, includes Chart.js from a CDN, and is safe to email or print to PDF
(`Cmd/Ctrl+P → Save as PDF`).

The structure matches `interactive_audit.html` exactly — sidebar nav,
executive KPI strip, funnel diagnostic, sentinel tracking panel, demographic
chart + table, geographic radar map with hover tooltips, and the 30-day
execution queue.

---

## White-label

Open `engine/report/template.html` and edit:

| What | Where |
|------|-------|
| Logo / agency name | line ~133: `<div class="logo">SNA_FORENSIC</div>` |
| Brand colors | top of `<style>` — `--red`, `--bg`, `--card`, `--border` |
| Footer system tag | line ~148: `SYSTEM: {{SYSTEM_ID}}` |
| Header title prefix | line ~155: `<h1>FORENSIC AUDIT: ...` |

To rebrand globally, just swap `--red` and the `.logo` text — every accent
follows that variable.

---

## Sample run

A complete synthetic Take Charge Roofing dataset ships under
`sample-data/take-charge-roofing/`:

```bash
npm run audit -- \
  --client "Take Charge Roofing" \
  --csv-dir ./sample-data/take-charge-roofing \
  --output ./reports/sample-take-charge-roofing.html
```

Stubs for `tropical-detailing`, `hello-floors`, `gutter-general`, and
`luxury-floors-depot` are also in `sample-data/` to demonstrate multi-client
operation.

---

## What the engine detects today

| Analysis | Detects |
|----------|---------|
| **Funnel leakage** | Impression → Click → Session → Lead drop-off. Flags stages below benchmarks (CTR < 0.5%, click-to-session < 30%, session-to-lead < 1%). |
| **Tracking failures** | Lead campaigns with spend but zero results (pixel disconnect), missing quality/engagement/conversion rankings, unset attribution windows, wrong optimisation events. |
| **Geographic waste** | DMA-level CPL vs median. Regions with >$50 spend and 0 leads flagged as `leak`. |
| **Creative scoring** | Top-quartile CPL winners, $100+ spend / zero-lead wasters, bottom-quartile waste. |
| **Spend efficiency** | 7 KPI cards: total spend, weighted CTR, blended CPL, leads, frequency, CPM, attribution health. |
| **Demographics** | Per-age-bracket CPL with `SCALABLE` / `MIXED` / `REDUCE` outcomes. |

---

## Known limitations

- **Meta only.** No Google Ads, TikTok, LinkedIn yet. Each requires its own
  parser module under `engine/parsers/`.
- **Single window.** No historical trend analysis — the engine audits the
  date range in the CSV you give it.
- **Heuristic pixel-failure detection.** Without raw pixel / CAPI event
  logs, "tracking broken" is inferred from CSV signals (missing rankings,
  spend-without-results, etc.). Reasonable false-positive rate on small data.
- **Benchmark database is hardcoded.** `--target-cpl` / `--target-ctr`
  override the defaults; longer-term we want a per-vertical benchmark store.
- **Geographic radar uses deterministic synthetic coordinates.** The radar
  map positions DMAs around the centre using a hash of the name. For a
  literal map (real lat/long) we need a geocoder pass.

---

## Architecture

```
engine/
├── parsers/
│   └── metaAdsCsv.ts          # CSV → typed rows (papaparse, header auto-detect)
├── analyses/
│   ├── funnelLeakage.ts
│   ├── trackingFailures.ts
│   ├── geographicWaste.ts
│   ├── creativeAnalysis.ts
│   ├── spendEfficiency.ts
│   └── demographics.ts
├── report/
│   ├── template.html          # Placeholder-tokenised copy of interactive_audit.html
│   └── generator.ts           # Mustache-style substitution + block rendering
├── scripts/
│   └── postbuild.js           # Copies template.html into dist/
├── types/index.ts             # Shared interfaces
└── index.ts                   # Commander CLI entry
```

Everything is plain TypeScript (`strict: true`) compiled to CommonJS under
`dist/`. The only runtime deps are `papaparse` and `commander`.
