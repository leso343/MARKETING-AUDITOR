# Blank Page Audits — Next.js Live Shell

Phase 2 SaaS shell. Drop a folder of Meta Ads CSVs, get a live forensic
dashboard with tuneable benchmarks.

## Quick start

```
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000 — click the Take Charge Roofing card.

## Folder layout

```
/app                                 — Next.js 15 App Router
  page.tsx                           — Client picker (home)
  audit/[client]/page.tsx            — Server component: reads CSVs, runs engine
  audit/[client]/AuditDashboard.tsx  — Client component: orchestrates the layout
  components/audit/                  — All visual modules
/engine                              — TS audit engine (unchanged)
  runAudit.ts                        — NEW: thin wrapper used by the Next page
  index.ts                           — Existing CLI (still works via `npm run audit`)
  analyses/                          — Funnel, tracking, geo, creative, demo, spend
  parsers/                           — CSV ingestion
  report/                            — Static HTML report generator (legacy)
/data
  benchmarks.json                    — Per-industry CPL/CTR/freq thresholds
  copy-bank.json                     — Pre-written recommendation copy
/public/csvs/<client-slug>/          — CSV drop folders
```

## Replacing the synthetic data

`/public/csvs/take-charge-roofing/` ships with synthetic stand-ins. Drop the
real Meta exports in (same filenames work; the parser is filename-agnostic) and
reload the page.

## Scripts

- `npm run dev`       — Next.js dev server on :3000
- `npm run build`     — production build
- `npm run start`     — production server
- `npm run audit`     — original CLI engine (writes a static HTML report)
- `npm run engine:test` — runs the engine against the bundled synthetic CSVs

## Live controls

The right sidebar exposes:
- **Industry benchmark** — switches to that industry's CPL/CTR defaults
- **Target CPL slider** ($20-$200) — recomputes findings & status pills
- **Target CTR slider** (0.5%-5%) — recomputes
- **Time window** — UI is in place; engine ignores it until date-stamped rows
  are imported

Controls write to query params (`?cpl=70&ctr=2.0&industry=roofing`) so
URLs are shareable.

## Engine architecture

`/app/audit/[client]/page.tsx` is a **Server Component**. On every request it:

1. Reads CSVs from `public/csvs/<client>/` via `fs`.
2. Calls `runAudit({ csvDir, clientName, benchmarks })` from `engine/runAudit.ts`.
3. Hands the resulting `AuditResult` to `AuditDashboard.tsx` (Client Component).

This keeps `papaparse` and `fs` on the server. The client bundle is just the
dashboard UI + the audit result JSON. The engine is identical to the CLI
version, so the static `.html` output and the live dashboard always agree.

## Tech stack

- Next.js 15 (App Router) + React 19 RC
- TypeScript (strict)
- Tailwind v4 (CSS-first config via `@theme` in `globals.css`)
- lucide-react icons
- recharts available (currently unused; reserved for future visuals)

## Adding a new client

For now (Phase 2 single-tenant), to test a second client:

1. `mkdir public/csvs/<new-slug>`
2. Drop CSVs in.
3. Visit `/audit/<new-slug>`.

A real multi-tenant flow (auth, DB-backed CSV uploads, plan tiers, etc.) lives
in a later phase — the home page has a stubbed "+ Add new client" tile to
remind future-you.
