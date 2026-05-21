# Front-End QA Pass

Audit of the dashboard, visualizers, charts, and UX surfaces against the
checklist in the agent prompt. This pass found no actionable defects;
the tier-2.5 bug-hunt + tier-3 deploy-safe + cleanup passes had already
fixed the categories of issues we were looking for.

## What was audited

### KPI cards & header (`KPISnapshot`, `AuditDashboard`, `AuditRibbon`)
- All numeric values flow in pre-formatted from the engine (`k.value`
  is a string, formatted in `engine/analyses/spend.ts`).
- Live re-evaluation in `KPISnapshot.liveStatus()` and
  `BenchmarkStatus` is fully guarded — `actual <= 0 || target <= 0`
  early-returns prevent NaN/Infinity propagation.
- `app/audit/[client]/page.tsx::parsePosNum` rejects `?cpl=foo`,
  `?cpl=-5`, and `?cpl=0`, so liveCpl/liveCtr can never be 0 or NaN.

### Visualizers
- `InteractiveFunnelExplorer`: empty-stages early-return, `Math.max(..., 1)`
  on maxCount, `(blendedCpl || 0)` on recovered USD.
- `TimeSeriesScrubber`: anomaly-tooltip division by `median` is guarded
  by `anomalyThreshold > 0`, which implies `median > 0`.
- `GeoBudgetReallocator`: `totalBudget <= 0` branch builds an equal-share
  allocation, and `r.cpl > 0` guards every lead projection.

### Recharts surfaces (`DemographicsPanel`, `RecommendationCards`, `TimeSeriesScrubber`)
- Axis ticks use `#666` on `var(--bg)` (#030303 / #0a0a0a) — passes WCAG
  AA at 10–11 px (~6:1 contrast).
- Tooltips render against `#111` with `#fff` text and `#888` muted, all
  AA-clean on dark.
- Numeric formatters: every Tooltip / tickFormatter explicitly rounds
  (`$${Math.round(v)}`, `Number(value).toFixed(2)`,
  `parseFloat(...toFixed(2))` on raw projection data). No raw
  floating-point fragments like `3137.110000001` reach the DOM.

### Leaflet (`CanvasMapPanel`)
- Markers, divIcons, popups, tooltips, zoom, and the heat-layer CDN load
  all use the standard `dynamic({ ssr: false })` pattern via the
  `AuditDashboard` import.
- Tooltips have dark-mode CSS overrides scoped to `.leaflet-tooltip`.
- Honest `inHeat` ranking + #1 pulse animation.

### Mobile (≤ 768 px)
- `Sidebar` collapses to a fixed top bar + slide-in panel below `lg`
  breakpoint (1024 px), with `lg:hidden` / `lg:flex` toggle.
- `ControlsPanel` has a paired mobile sheet (`mobileOpen` state).
- Touch targets ≥ 44 px on the visualizers' interactive rows
  (`minHeight: 56`, `height: 44`).

### Accessibility
- All `<img>` elements carry `alt` attributes
  (`Sidebar`, `setup/page.tsx`).
- Form inputs use `focus:border-[var(--red)]` colour change (acceptable
  visible focus, though outline is removed).
- `aria-pressed` on funnel stage buttons, `aria-label` on the mobile
  nav toggle.

### Copy bank (`data/copy-bank.json`)
- 17 UI keys, every key has both `pro` and `plain` variants.
- `LangProvider` defaults to `plain` and persists choice in
  `localStorage` (`sna-lang`).

### Print mode (`?print=true`)
- `AuditDashboard` hides Sidebar, ControlsPanel, header buttons, ribbon,
  what-if banner, and the three interactive visualizers when
  `printMode=true`.
- `.print-mode` CSS clips to 8.5 in, kills all animations and
  transitions, and applies `page-break-inside: avoid` to each section.

## Verdict

No code changes required for FE QA. The components shipped with
defensive coding throughout. This summary commit documents the audit
trail.
