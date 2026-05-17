# Take Charge Roofing — CSV drop folder

The files in this directory are **SYNTHETIC stand-ins** so the dev server
renders a populated dashboard the first time you boot it.

## To switch to real data

1. Export the actual Meta Ads Manager CSVs from `ads.facebook.com` for this client.
2. Drop them in here, keeping the same filenames:
   - `campaigns.csv` (campaign-level)
   - `adsets.csv` (ad-set level, with Age + Gender + Location columns)
   - `ads.csv` (ad-level with Headline/Body/Creative columns)
   - `breakdown_age_gender.csv` (Campaign × Age × Gender breakdown)
   - `breakdown_dma.csv` (Campaign × DMA region breakdown)
   - `breakdown_placement.csv` (Campaign × Placement breakdown)
3. The parser is filename-agnostic; it classifies by header signatures. Any
   `.csv` in this folder gets ingested, so you can drop in additional
   breakdowns (device, hour) and they'll be picked up automatically.
4. With `npm run dev` running, the page hot-reloads automatically on CSV changes.

The synthetic dataset matches the same shape as a real Meta export, so swapping
them is a true 1-for-1 replacement — no schema adjustments needed.
