# Take Charge Roofing — CSV data folder

This directory contains **real Meta Ads Manager exports** for Take Charge Roofing
(Atlanta, GA roofing company). Data range: Apr 15 2023 – May 15 2026.

## Files

| File | Type | Rows | Notes |
|------|------|------|-------|
| `campaigns.csv` | Campaign-level summary | 8 | All campaigns, full date range |
| `reference/campaigns-last-month.csv` | Campaign-level summary | 8 | Apr 15 – May 14 2026 only — in reference/ to avoid double-counting all-time metrics |
| `ads.csv` | Ad-level report | 60 | Per-ad spend, results, rankings |
| `breakdowns.csv` | DMA breakdown | 58 | Per-(ad set × DMA) rows; drives geographic analysis |
| `breakdown_age_gender.csv` | Age breakdown | 40 | Per-(campaign × age) rows with leads |
| `breakdown_placement.csv` | Platform/Placement breakdown | 83 | Per-(campaign × platform × placement) rows |

## Parser classification

The parser auto-classifies every CSV by inspecting its column headers:
- `Ad name` present → **ad** file
- `DMA region` present → **breakdown/dma** (takes priority over "Ad set name")
- `Ad set name` present → **adset** file
- `Platform` / `Placement` present → **breakdown/placement**
- `Age` present → **breakdown/age_gender**
- Otherwise → **campaign** file

## To refresh data

Export new CSVs from Ads Manager and drop them in here, keeping the same
filenames. The dev server re-runs the engine on every page request.

**Never add synthetic or placeholder CSVs to this folder.** If no files are
present the dashboard renders an explicit "No data" empty state.
