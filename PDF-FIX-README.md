# PDF export — memory tuning for Vercel Hobby plan

## What this fix does

The PDF export route (`app/api/audit/[client]/pdf/route.ts`) renders the
audit dashboard with headless Chromium via Puppeteer. Chromium is hungry,
and the route was originally configured to request **3008 MB** of Lambda
memory in `vercel.json`.

That ceiling is **only available on the Vercel Pro plan**. On the personal
(Hobby) plan, serverless functions are capped at **2048 MB**. Vercel rejects
the deploy with:

> Serverless Functions are limited to 2048 mb of memory for personal
> accounts (Hobby plan).

This PR drops the requested memory to **2048 MB** and adds compensating
Chromium flags so the browser actually fits inside that smaller envelope.

## What changed

- `vercel.json`: PDF route `memory: 3008` → `memory: 2048`. `maxDuration: 60`
  is unchanged.
- `app/api/audit/[client]/pdf/route.ts`:
  - Extra Chromium launch args: `--disable-dev-shm-usage`,
    `--disable-gpu`, `--single-process`, `--no-zygote`, and a few
    `--disable-*-backgrounding` flags. `--single-process` is the one that
    actually lets Chromium run inside a 2 GB Lambda; the rest trim
    allocations around the edges.
  - Viewport shrunk from **1240×1600 @2x** to **1280×800 @1x**. The 2×
    device-scale factor was allocating roughly 4× the raster buffer of a 1×
    render and was pushing us over the cap. PDF output uses
    `printBackground: true` and the Letter page format, both unchanged.

## The trade-off (read this before merging)

A single-process Chromium inside a 2048 MB Lambda is on the **edge** for
non-trivial dashboards. If memory issues persist after this patch, options
are:

1. **Upgrade to Vercel Pro** (~$20/mo), restore `memory: 3008` (or up to
   4096 MB), drop the `--single-process` flag, and bump the viewport back
   up for higher-resolution renders.
2. **Switch the PDF generator to a pure-JS library** (`jspdf` or
   `react-pdf`). No Chromium, no Lambda memory headache, fits comfortably
   inside Hobby. Cost: you lose the "render the live dashboard exactly as
   shown" property — anything chart-related has to be re-implemented in the
   PDF generator.

Option 2 is the right call long-term if Hobby is the permanent plan.
Option 1 is the right call if Lester ever ships this to paying users.

## Smoke test

After deploy, hit `/api/audit/<client>/pdf` for a real client slug. A
successful render returns `Content-Type: application/pdf` and a binary
body. A failure returns an HTML error page (intentionally — see the
existing comment block at the top of the route file).
