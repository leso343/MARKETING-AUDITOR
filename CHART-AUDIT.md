# Chart Audit — Marketing Auditor Dashboard

Scope: every chart/graph/visualization in `app/audit/[client]/AuditDashboard.tsx`
and `app/components/audit/ReportViewer.tsx`, sourced from
`app/components/audit/*.tsx` and `app/components/visualizers/*.tsx`. Engine
result shapes cross-referenced against `engine/analyses/*.ts`.

Charting library in use: **Recharts** for `DemographicsPanel`, `PlacementsPanel`,
`DevicesPanel`, `RecommendationCards`, and `TimeSeriesScrubber`. Custom CSS/SVG
bars and grids for everything else. **Leaflet** (with `leaflet.heat` via CDN
script) for `CanvasMapPanel`.

---

### FunnelLeakageChart.tsx
- **Shows:** A 4-stage funnel — Impressions → Clicks → Sessions/Landing Views →
  Leads — with the count per stage and the % of the previous stage retained
  (color-coded ok/warn/critical).
- **Type:** Custom horizontal "bar" rendered as a stacked div per stage, where
  the bar width is `stage.count / maxCount * 100%` and a colored tint reflects
  the stage's status.
- **Appropriate:** YES — a horizontal proportional funnel is the right idiom for
  drop-off across a fixed, ordered set of 4 stages and reads cleanly without a
  chart library.
- **Interactivity:**
  - No hover tooltip on the bars. The retention % is shown inline on each row
    which makes a tooltip optional but a hover state would make the per-stage
    `stage.note` discoverable instead of crammed into the small text below.
  - Click handler only on the "View full analysis" footer button; the bars
    themselves are not clickable (the *InteractiveFunnelExplorer* component
    handles that).
  - No empty/null state — `Math.max(..., 1)` prevents divide-by-zero but if all
    stages are 0 every bar still renders at 0 width. Safe but ugly.
- **Accuracy:**
  - `widthPct` is normalized to the max stage (always impressions), so all
    downstream stages look near-zero by comparison on a healthy account. A
    log-scale option or "% of previous" inline number is the only thing
    rescuing readability — and the inline `retentionPct` does that work, so
    this is acceptable.
  - The retention status thresholds (CTR < 0.5% critical, click-to-session <
    30% critical) are wired through from the engine and color-coded
    consistently (green/amber/red). Direction matches expectation.
- **Priority:** **P3** — works fine. Optional polish: add `<title>` or
  `aria-label` on each row to surface `stage.note` on hover/SR.

---

### TrackingFailuresPanel.tsx
- **Shows:** Tracking health KPIs (broken lead-campaign count, wasted $, score
  out of 100, failure count) plus a list of detected failures with severity,
  description, and dollar impact.
- **Type:** Big-number stat cards + a "waste-meter" progress bar showing the
  fraction of lead campaigns that are broken + a vertical list of failure
  cards. No real chart.
- **Appropriate:** YES — small set of categorical findings; a list+stats layout
  is correct. The progress bar correctly visualises a % (broken / total).
- **Interactivity:**
  - "View full analysis" button works.
  - No filtering / sort / drill on the failures list. Acceptable given list is
    usually 0–4 items.
  - Failure list has no empty state visually distinct from "no failures"; the
    "No tracking failures detected" string handles it.
- **Accuracy:**
  - `wastedPct` is clamped to 100 via `Math.min(100, wastedPct)` — good.
  - When `totalLeadCampaigns === 0`, `wastedPct` falls to 0 and the bar
    correctly hides, but the big number ("brokenLeadCampaigns") also goes to
    0 with no explanatory context — "no lead-objective campaigns ran" should
    arguably be surfaced instead of a misleading "0 broken" all-clear.
  - The failure-card `estimatedImpact` is shown raw without telling the user
    it's an *estimate* (e.g. `RANKING_DATA_MISSING` impact is `spend * 0.15`,
    a heuristic). Could mislead.
- **Priority:** **P2** — minor polish: distinguish "no lead campaigns ran"
  from "0 broken"; mark heuristic impacts as estimates.

---

### GeographicHeatmap.tsx
- **Shows:** Per-region (DMA/city) breakdown with spend, leads, CPL (or CPC for
  Traffic-objective accounts), status badge (hot/mixed/cold/leak), plus a
  spend-bar embedded in the Spend cell.
- **Type:** Data table with an inline 2-px red bar per row representing
  `spend / maxSpend`. Three KPI summary cards above it.
- **Appropriate:** YES — for 10–25 DMAs a sortable table beats any chart and
  the inline mini-bars give visual weight without occupying real estate. The
  costMetricLabel prop honestly relabels CPL↔CPC based on objective.
- **Interactivity:**
  - Empty state present and useful ("Drop breakdowns.csv...").
  - No client-side sort — server returns sorted by spend desc which is the
    right default.
  - `title` tooltip on the region name handles truncation. Good.
  - `liveCpl` slider feedback is wired through: each row gets a green/red
    "✓ below $X target" / "✗ above $X target" badge that updates live.
- **Accuracy:**
  - Inline spend bar is `(r.spend / maxSpend) * 100` — purely proportional, no
    axis. Always honest because it's a relative bar within rows.
  - When `r.cpl === 0` the column shows "—" instead of "$0.00" — correct.
    Null is correctly distinguished from zero.
  - Status color scale: leak = red, cold/mixed = amber, hot = green. Direction
    matches "red = bad". Good.
- **Priority:** **P3** — works fine.

---

### CanvasMapPanel.tsx
- **Shows:** Leaflet map of Georgia with: (a) a red→yellow lead-density
  heatmap, (b) numbered top-5 storm pins ranked by severity × proximity to
  Atlanta heat, (c) lower-priority circle markers for other recent storms,
  (d) an Atlanta lead-count label, (e) an out-of-area "spent money, got no
  leads" marker for NC/SC.
- **Type:** Interactive geographic map (Leaflet + leaflet.heat) with custom
  div-icon overlays. Below the map: a top-5 priority list and a legend.
- **Appropriate:** YES — geographic priority ranking with severity is
  fundamentally a map problem; pins + heatmap is the correct idiom.
- **Interactivity:**
  - Hover tooltip on each pin shows rank, location, severity, date, and "high
    priority" flag. Working.
  - `scrollWheelZoom: true` and pan are enabled.
  - **No data binding** — `BAKED_STORMS` and `LEAD_HEAT` are hardcoded
    constants for GA only. The component takes zero props and will render the
    same Marietta/Buckhead/Conyers content no matter which client's audit is
    being viewed. The "BAKED SNAPSHOT · NCEI SCHEMA" label in the priority
    list acknowledges this, but it's still misleading inside a client-specific
    dashboard.
  - `leaflet.heat` is loaded via injected `<script>` from unpkg every mount;
    no SRI hash, no error handling if the CDN fails, and the script is
    re-injected on every mount (no de-dupe check beyond `initRef`).
  - Default Leaflet icons are patched to unpkg URLs — another CDN dependency.
- **Accuracy:**
  - The "ATLANTA · 30 LEADS" pill is hardcoded. Real client lead count is
    nowhere referenced.
  - The "$21.22 SPENT · 0 LEADS · NC/SC" pill is hardcoded.
  - Storm severity scoring (`scoreStorm`) is sensible but operates on a fake
    dataset; calling this a "Canvas Priority Map" inside an audit dashboard
    implies the data is real and current.
- **Priority:** **P0 (misleading)** — this is the most dangerous chart in the
  audit. It looks like the only geographic intelligence in the report, but it
  is 100% canned demo data with no relationship to the active client. Either
  hide it for non-Atlanta accounts, label it clearly as a demo/sample, or wire
  it to real DMA + NCEI storm pulls.

---

### CreativeAnalysisGrid.tsx
- **Shows:** Top 3 "winner" ads (lowest CPL with `leadResults > 0`) and top 3
  "waster" ads ($100+ spend with zero lead-results), each with name, body,
  CPL/CPC, CTR, and a target-comparison badge.
- **Type:** Two vertical lists of "AdCard" components (no chart at all — these
  are 3-up cards per side). Each card has a thumbnail placeholder, headline,
  body, 3 metrics, and a status reason line.
- **Appropriate:** YES — ranking 3 winners and 3 wasters is a list problem,
  not a chart problem. No need for visualization beyond the per-card
  formatting.
- **Interactivity:**
  - No hover, no click on individual cards (just "View full analysis").
  - `liveTag` badge updates when the user drags the CPL slider. Good.
  - Conditional metric: shows CPL when `ad.cpl > 0`, otherwise CPC. Honest
    handling of Traffic-objective ads (no fake "$0.39 CPL win").
- **Accuracy:**
  - The Image thumbnail is always a placeholder icon — `<ImageIcon />` —
    never the actual creative. This is OK for an aggregate audit but the
    component shape (`flex h-12 w-12`) implies images would land there.
  - `creative.clickWinners` from the engine is **never rendered** even though
    the engine specifically separates `winners` (lead-CPL) from `clickWinners`
    (traffic CPC) to avoid contamination. For a pure Traffic-objective account
    you'll see "No conversion-positive ads yet" with no other surface for the
    click-cost leaders the engine computed. The engine did the work; the UI
    drops it on the floor.
- **Priority:** **P1** — render `creative.clickWinners` for Traffic-objective
  accounts so they aren't shown an empty winners list when the engine has data.

---

### DemographicsPanel.tsx
- **Shows:** CPL by age bracket (25-34, 35-44, 45-54, 55-64, 65+) — both as a
  shaped area chart (CPL curve) and as a 5-column table with spend/leads/CPL/
  status pill.
- **Type:** Recharts `<AreaChart>` (CPL curve, gradient-filled, with target
  reference line) + a data table below.
- **Appropriate:** **SUBOPTIMAL** — an area chart implies the X-axis is a
  continuous quantity (time, money) where the area-under-curve has meaning. Age
  brackets are an ordered categorical axis; the area-under-curve doesn't
  represent anything physical. Use a **bar chart** (one bar per bracket,
  colored by status outcome) which makes the per-bracket CPL directly
  comparable without implying interpolation.
- **Recommended:** Horizontal or vertical bar chart, one bar per bracket,
  with the same status color (green = SCALABLE, amber = MIXED, red = REDUCE).
  Keep the dashed target reference line.
- **Interactivity:**
  - Tooltip works and shows "Age X-Y: $N.NN / lead". Good.
  - `targetCpl` reference line updates live when the CPL slider moves (passed
    via prop). Good.
  - No click-to-filter on a bracket.
  - Table renders all brackets including ones with zero spend (`opacity: 0.3`
    in that case). Good.
- **Accuracy:**
  - The 18-24 bracket is silently dropped from the chart: `BRACKET_ORDER`
    excludes "18-24" even though the engine `AGE_BUCKETS` includes it.
    Looking at the code: `BRACKET_ORDER = ["25-34", "35-44", "45-54", "55-64",
    "65+"]` — line 43. So 18-24 spend never appears in the area chart even
    when present in the data. The table still shows it. **This is a real
    data-loss bug.**
  - The gradient stroke (green → amber → red, left to right by position)
    bakes a color story into the X-axis order that has nothing to do with the
    actual CPL values. A 25-34 bracket with a $200 CPL renders in green; a
    65+ bracket with a $20 CPL renders in red. **The color is positional, not
    value-driven.** Misleading.
  - "Best bracket" callout filters to `outcome === "SCALABLE" && b.cpl > 0`
    and picks the lowest CPL among those — correct logic.
- **Priority:** **P1** — wrong chart type, 18-24 dropped, color encodes
  position not value. Three independent fixes needed.

---

### PlacementsPanel.tsx
- **Shows:** Spend by placement (Feed/Stories/Reels/Audience Network/etc.)
  with CPL, CTR, and score (winner/acceptable/underperforming/wasting). Top
  10 placements by spend shown in the bar chart; full list in the table.
- **Type:** Recharts vertical `<BarChart>` of spend, with each bar colored by
  its score. Plus a data table.
- **Appropriate:** YES for placements (typically 5–12 of them); a bar chart
  ordered by spend with score-colored bars is the right call. Horizontal bars
  would actually be slightly better for readable labels (the current chart
  uses `angle={-30}` to rotate placement names, which works but is harder to
  scan than a horizontal layout).
- **Recommended:** Optional — horizontal bar chart would simplify label
  reading. Not a blocker.
- **Interactivity:**
  - Tooltip shows placement name, CPL, lead count, spend, and CTR. Working.
  - `targetCpl` prop is accepted but **never used** inside the component. The
    parent passes it; the component drops it. Dead prop.
  - No click handler on bars.
  - Empty-state message present and useful.
- **Accuracy:**
  - Y-axis starts at 0 (Recharts default) — honest.
  - Bar colors come from `SCORE_COLOR` keyed off the engine's
    median-based scoring. Direction matches (red = wasting, green = winner).
  - Chart only shows top 10 by spend, but the table shows all — small
    inconsistency: a placement ranked 11+ by spend appears in the table but
    not the chart, with no UI hint.
  - When `e.results === 0`, CPL is shown as "—". Correct null handling.
- **Priority:** **P2** — drop the unused `targetCpl` prop or use it as a
  reference line on the chart (consistent with `DemographicsPanel`).

---

### DevicesPanel.tsx
- **Shows:** Spend share by device type (mobile/desktop/tablet/other) plus a
  per-device table with CPL/CTR/score.
- **Type:** Recharts donut (`<PieChart>` + `<Pie>` with `innerRadius={40}
  outerRadius={70}`) sized 160×160, paired with a vertical legend listing each
  device's spend %. Plus a data table.
- **Appropriate:** YES — devices are 2–4 categories max (mobile/desktop/
  tablet/other). A donut is acceptable here. Even better would be a horizontal
  stacked bar to compare both share and CPL side by side, but a donut for a
  small fixed set is fine.
- **Interactivity:**
  - Donut tooltip shows device name, spend, lead count, CPL, and CTR. Good.
  - Legend dot+name+% list works.
  - No click handler.
  - Empty state present.
- **Accuracy:**
  - Donut fills are derived from `deviceColor(name)` which substring-matches
    "mobile", "desktop", "tablet" in lowercase. Anything that doesn't match
    becomes grey. If the breakdown export uses non-English device names this
    falls through to the grey "other" color — minor.
  - Donut uses `dataKey="spend"` and `paddingAngle={2}` — meaningful angles.
  - Score color (table) and device color (donut) use **two different color
    systems**. The donut colors devices by type (mobile purple, desktop blue);
    the table colors the score pill by performance (red/amber/green). A user
    might interpret the donut color as a status indicator and get confused. A
    small "color = device type" legend marker on the donut would resolve this,
    or align both palettes.
- **Priority:** **P2** — small polish on color-system clarity. Otherwise fine.

---

### TimeOfDayPanel.tsx
- **Shows:** Hour-of-day breakdown (0–23) with spend, leads, CPL, and score
  (peak/good/low/dead). Visualised as a 24-cell heatmap grid plus a full data
  table plus three KPI cards (peak hours / dead hours / potential savings).
- **Type:** 24-cell CSS grid heatmap where each cell's background opacity is
  `spend / maxSpend` and color comes from the score (green/blue/grey/red).
  Backed by a data table for exact numbers.
- **Appropriate:** YES — a 24-hour heatmap is the canonical dayparting
  visualisation and the implementation is clean. Even better would be a 7×24
  weekday/hour heatmap, but the current engine only outputs hour buckets.
- **Interactivity:**
  - Native `title` tooltip on each cell shows hour, spend, leads, CPL.
    Working but native tooltips are slow and unstyled — a custom tooltip
    would feel more premium.
  - No click handler / no drill-down.
  - Legend present and color-keyed to score.
  - Empty state present.
- **Accuracy:**
  - Hex-alpha math: `Math.round(intensity * 40 + 8).toString(16).padStart(2,
    "0")` — this clamps to a max of 48/255 alpha for the background, which is
    fine for low-contrast heatmaps. But for an hour with `spend = 0`, the
    cell still gets a `0x08` alpha tint, making it look slightly active. A
    truly zero hour should be visually distinct (e.g. transparent
    background, dashed border).
  - The CPL value shown inside each cell is rounded to whole dollars (`$${h.
    cpl.toFixed(0)}`) — for CPLs under $1 this collapses to "$0", losing
    signal.
  - Cell color depends on `score`, but `score` is derived from CPL against the
    median. So a "dead" hour (zero results, $20+ spend) is colored red — good.
    A "low" hour with $0 spend is colored grey — good.
- **Priority:** **P2** — minor: distinguish $0-spend hours visually; surface
  sub-$1 CPL with 2 decimal places.

---

### BenchmarkStatus.tsx
- **Shows:** Three large stat cards — Blended CPL, Weighted CTR, Industry/
  target context — each with a "PASS/FAIL" pill, a thin progress bar showing
  how close to target, and a delta string. Plus two contextual InsightCards
  that appear when sliders are moved.
- **Type:** Three stat cards with mini progress bars (1px tall). No real
  chart.
- **Appropriate:** YES — comparing a single metric to a single target is best
  served by a number + bar, not a chart.
- **Interactivity:**
  - Updates live when the user moves the CPL or CTR slider. Good.
  - Insight cards only appear in `isPreview` mode (after a slider has been
    moved). Good UX.
  - No hover/click on the cards themselves.
- **Accuracy:**
  - `barPct = Math.min(lowerIsBetter ? (actual / target) * 100 : (target /
    actual) * 100, 100)` — clean math, capped at 100%. Honest.
  - `accent = passing ? "#4ade80" : absDelta > 50 ? "#ff0000" : "#fbbf24"` —
    correct color mapping (green pass, amber close-miss, red far-miss).
  - Metric returns null when `actual <= 0 || target <= 0`, which silently
    hides the entire card with no explanation. For a Traffic-objective
    account with `blendedCpl = 0`, the CPL card vanishes. Probably intentional
    but the user has no way to know why a card disappeared between renders.
- **Priority:** **P3** — works fine.

---

### KPISnapshot.tsx
- **Shows:** A horizontally-scrolling strip of 5–8 KPI cards (Total Spend, CTR,
  CPL, CPC, Leads, Frequency, CPM, Attribution).
- **Type:** Stat cards with a colored status dot. No chart.
- **Appropriate:** YES — at-a-glance KPI strip is the right pattern for top-
  of-page summary.
- **Interactivity:**
  - Cards have `title={k.label}` for tooltip context.
  - Status dot for CPL/CTR is re-derived client-side from `liveCpl`/`liveCtr`
    so the dots update live as sliders drag. Good.
  - No click drill-down.
  - Horizontal scroll on overflow is the right responsive approach.
- **Accuracy:**
  - When `liveCpl != null && blendedCpl != null`, status is recomputed (ok if
    under target, critical if >1.5x, warn otherwise). The benchmark label is
    also rewritten ("Target: $X"). Consistent.
  - Status color "warn" for `k.status === "warn"` — fine.
  - The "Lead_Volume" card colors its dot critical when `totalLeads === 0`
    via the engine, not here — depends on engine output.
- **Priority:** **P3** — works fine.

---

### AuditRibbon.tsx
- **Shows:** Horizontal pill strip of ~9 chips (Spend, CTR, CPL, CPC, Leads,
  Freq, Tracking, Geo Waste, Winners, Wasters) — each with label, value, and
  colored status dot. Sticky/scrollable below the header.
- **Type:** Chip strip with anchor-scroll click handlers. No chart.
- **Appropriate:** YES — analogous to a stock ticker for an ad account.
- **Interactivity:**
  - Each chip is a `<button>` with an `anchor` prop that scrolls to the
    matching section. Working.
  - Status dot for each chip is derived from its own threshold logic — CPL
    critical if >1.5x target, warn if >1x target. Frequency critical >4, warn
    >2.5. All consistent with KPISnapshot.
  - "Full Report" button at the end calls `openReport(1)`. Working.
- **Accuracy:**
  - CPL chip is only shown when `spend.blendedCpl > 0`, hiding it for
    Traffic-objective accounts. Good honest behavior.
  - CPC chip shown only when `spend.weightedCpc > 0`. Good.
  - No misleading aggregations.
- **Priority:** **P3** — works fine.

---

### RecommendationCards.tsx
This component packs **three separate charts** plus a recommendation list and
a budget-intelligence section. Auditing each chart in turn.

#### Recommendation list (top section)
- **Shows:** Up to ~7 prioritised findings, each as a card with severity,
  dollar impact, fix steps.
- **Type:** Card grid. No chart.
- **Appropriate:** YES.
- **Priority:** **P3**.

#### 30-Day CPL Projection (LineChart)
- **Shows:** Two synthetic CPL curves over Day 0–30 — "with fixes" (green
  solid) and "without fixes" (red dashed), with the target as a dashed
  reference line.
- **Type:** Recharts `<LineChart>` with two `<Line>` series, custom dark
  tooltip, target `<ReferenceLine>`, fixed Y-axis ticks at $20 intervals.
- **Appropriate:** YES — projecting two scenarios over time is the textbook
  use of a line chart.
- **Interactivity:**
  - Tooltip works and shows both series at the hovered day.
  - Custom legend rendered below the chart (Recharts default legend is not
    used). Acceptable.
  - No interactivity beyond tooltip — these are projected curves, not real
    data; can't drill down.
- **Accuracy:**
  - The projection math is a hand-tuned heuristic, not a model. Whether the
    user understands that depends on copy: the "italic" caption below the
    chart reads "Executing the fix queue should pull CPL from $X → $Y by Day
    30" — phrased as fact, not a projection. Could mislead. Adding "based on
    typical recovery curves" or similar would be honest.
  - When CPL is already below target, the lines invert sensibly (green keeps
    improving, red drifts up toward the ceiling) — good design choice.
  - The Y-axis starts at 0 (`domain={[0, yMax20]}`) — honest.
  - Target reference line is always inside the visible range because of the
    `yMax20` calculation. Good.
- **Priority:** **P2** — soften the projection caption to acknowledge it's a
  model, not data.

#### Budget Pie Charts — Current vs Recommended (two donuts)
- **Shows:** Two donuts side by side. Left = current allocation (Converting /
  Mixed / Dead Weight from engine data). Right = recommended 70/20/10 (Scale
  Winners / New Placements / Experiments).
- **Type:** Two Recharts donuts, 140×140 each, with a center text label.
- **Appropriate:** **SUBOPTIMAL for the left donut.**
  - The "Converting" slice uses `winnerSpend = sum(creative.winners.spend)`
    which is *only the top quartile of converting ads*. The "Dead Weight"
    slice is creative wasters + geo waste, capped at 70% of total spend. The
    "Mixed" slice is whatever's left. **These three buckets are computed by
    different rules with different units mixed in**, then displayed as if
    they're a clean partition of total spend. Geographic waste and creative
    waste can overlap (a wasted creative running in a wasted geo is
    double-counted in the raw inputs, then artificially clamped at 70%). The
    donut implies a clean disjoint partition that doesn't actually exist.
  - The right donut (70/20/10) is a fixed framework recommendation, not data.
    Visualising a fixed prescription as a donut is fine, but pairing it
    side-by-side with the (suspect) current donut implies a like-for-like
    comparison.
- **Recommended:** Either (a) replace the left donut with a stacked horizontal
  bar showing Winner spend + Waster spend + Geo waste with clear labels and
  explicit overlap handling, OR (b) keep the donut but document its
  methodology directly on the card so users understand the "mixed" bucket is
  a residual, not a measurement.
- **Interactivity:**
  - No tooltips (`isAnimationActive={false}`, no `<Tooltip>` child). The
    inner-text only shows total budget for left, "70/20/10" for right. No
    slice hover.
  - Legend dots below each donut. OK.
- **Accuracy:**
  - `totalWaste = Math.min(wasteCreative + wasteGeo, totalSpend * 0.7)` —
    the 70% clamp prevents totally-bonkers outputs but is a magic number.
  - `mixedSpend = Math.max(0, totalSpend - winnerSpend - totalWaste)` — a
    residual, with no semantic meaning of its own. It's just "what's left".
  - `projCplAfterCuts = (totalBudget - totalWaste) / totalLeads` assumes
    cutting waste doesn't reduce leads. Reasonable since the wasted spend
    didn't produce leads by definition.
- **Priority:** **P1** — left donut visualises a methodology that the user
  cannot inspect. Either explain the bucket definitions on the card or change
  the chart to one that doesn't require hidden assumptions.

#### Budget Tiles (stat cards above the donuts)
- **Shows:** Three large tiles — Converting / Mixed / Dead Weight — with $
  amount, %, mini progress bar, and an action verb ("SCALE THIS" / "OPTIMISE"
  / "ELIMINATE").
- **Type:** Stat cards with a 2px progress bar each. No chart.
- **Appropriate:** YES, given the same inputs.
- **Accuracy:** Same caveats as the left donut — these bucket definitions are
  not orthogonal.
- **Priority:** **P1** (inherits from donut). Fix the bucket math and these
  tiles improve automatically.

#### Recommended Reallocation 70/20/10 row
- **Shows:** Three cards: "Scale Winners (70%)", "New Placements (20%)",
  "Experiments (10%)" with dollar amounts derived from `totalBudget * 0.7 /
  0.2 / 0.1`.
- **Type:** Stat cards. No chart.
- **Appropriate:** YES.
- **Priority:** **P3**.

#### Priority Fix Queue
- **Shows:** Numbered, ordered list of findings with "WHY this is ranked
  here" and "OUTCOME →" copy.
- **Type:** List. No chart.
- **Appropriate:** YES.
- **Priority:** **P3**.

---

### ExecutiveSummary.tsx
- **Shows:** Top 3 findings ranked by dollar impact, each as a card with
  icon, title, detail, and "$X impact".
- **Type:** Stat-card grid. No chart.
- **Appropriate:** YES.
- **Interactivity:** None (no drill-down, no link to detail). The "Total
  Recoverable" tally is the sum across the 3 visible cards.
- **Accuracy:**
  - `totalRecoverable` is summed across the 3 visible findings only. If
    there are 7 critical findings, only the top 3's dollar impact shows up
    in the headline figure. This could under-state recoverable spend by a
    lot. The card should sum **all** findings or label the figure "Top 3
    Recoverable" honestly.
- **Priority:** **P1** — "Total Recoverable" headline lies when findings >3.

---

### InteractiveFunnelExplorer.tsx (visualizer)
- **Shows:** Same 4-stage funnel as `FunnelLeakageChart` but with each stage
  as a clickable button. Selecting a stage exposes a "target retention %"
  slider that projects how many extra leads + dollars would be recovered
  downstream if that stage held its traffic better.
- **Type:** Stacked horizontal bars per stage (CSS, no library) with a
  "projected" green overlay on the selected stage and below. Plus a what-if
  slider + live readouts.
- **Appropriate:** YES — interactive what-if is the right metaphor for a
  funnel; users intuit "what if this stage worked better".
- **Interactivity:**
  - Stage buttons have proper `aria-pressed` and `aria-label` — accessible.
  - Slider has `min=0, max=100, step=1`, accent-color updates by sign of
    delta. Updates projection live.
  - "Reset" button restores the slider to current retention. Good.
  - `prefers-reduced-motion` respected (transitions disabled). Good.
  - 44px+ touch targets enforced. Good.
- **Accuracy:**
  - Projection logic preserves upstream stages' counts and applies the new
    target retention only at the selected stage; downstream stages keep
    *current* retention rates and propagate the new upstream count. This is
    a defensible model and the in-component docstring explains it.
  - Recovered USD = `recoveredLeads * blendedCpl` — the labels say "Money it's
    worth" / "Recovered spend value", which is slightly muddled. The math is
    "if you recover N leads at your current $/lead, that's worth ~$X" — which
    is a *value* calculation, not a *savings* one. The copy says "recover" which
    implies savings. Minor wording fix.
  - First-stage selection (Impressions) keeps `out.push({ count: stage.count
    })` — slider does nothing meaningful for stage 0. The UI lets you select
    it and drag the slider with no projection change. Could disable.
- **Priority:** **P2** — disable slider on stage 0; clarify recovered-USD
  copy.

---

### TimeSeriesScrubber.tsx (visualizer)
- **Shows:** Weekly CPL line over the audited reporting window, with a
  median reference line, anomaly dots (red, for weeks > 2× median), and a
  large custom scrubber below the chart. Active week details (spend, leads,
  ad sets running) shown beside.
- **Type:** Recharts `<LineChart>` with custom `dot` render, plus a custom
  pointer-events-driven scrubber track (not Recharts Brush) and a detail
  card.
- **Appropriate:** YES — weekly CPL over time is the textbook line-chart
  use case; anomaly dots highlight without distracting.
- **Interactivity:**
  - Custom scrubber supports mouse drag, touch, and keyboard arrows + Home/
    End. Proper `role="slider"` with `aria-valuemin/max/now/text`. Good.
  - `prefers-reduced-motion` respected. Good.
  - Recharts default tooltip shows on chart hover. Good.
  - The scrubber thumb position and the chart's hover dot are independent —
    moving the chart cursor doesn't update the scrubber, and vice versa. This
    is a small UX seam (two parallel cursors on the same data) but defensible
    given each has different affordances.
  - Empty state ("No weekly data available") present.
- **Accuracy:**
  - Anomaly threshold = `median * anomalyMultiplier` (default 2). Reasonable.
  - When a week has `cpl === 0` (no leads), the line drops to 0 — Recharts
    draws a line down to 0 and back up which can dominate the chart visually.
    Setting `cpl=0` to null and using `connectNulls={false}` would be cleaner,
    but the current engine only emits weeks where spend>0 OR leads>0, so a
    spend-only week still plots a 0 CPL. **A spend-only week is real signal
    (you paid and got nothing) but the chart treats it the same as a
    no-data week.**
  - The line color is fixed red (`#ff0000`) regardless of week performance.
    Anomaly dots are red on top of a red line — they pop only because they
    have a fill ring, not because of color contrast. Minor.
  - Y-axis starts at the Recharts auto-min, not at 0. For a chart showing
    cost, starting above 0 can exaggerate the relative size of a spike. Add
    `domain={[0, 'auto']}` for honesty.
- **Priority:** **P2** — Y-axis should start at 0; handle spend-only / zero-
  lead weeks distinctly.

---

### GeoBudgetReallocator.tsx (visualizer)
- **Shows:** One row per DMA with a 0–100% slider; total stays at 100% via
  auto-rebalance across unlocked rows. Live readout: projected leads under
  the new allocation (`Σ newSpend_dma / cpl_dma`).
- **Type:** Stack of slider rows + a top KPI block. No chart.
- **Appropriate:** YES — interactive budget reallocation across N regions
  with a fixed sum needs sliders, not a chart.
- **Interactivity:**
  - Pointer + keyboard friendly. 44px+ hit targets. Lock/unlock per row.
    `prefers-reduced-motion` respected.
  - Reset button restores original allocation. Disabled when no changes.
  - Empty state present.
- **Accuracy:**
  - "No signal" badge correctly flags DMAs with `cpl === 0` and excludes them
    from the projection — projecting leads against an unknown CPL would be a
    fabrication. Honest.
  - Rebalance math: proportional to current `pct` of unlocked rows, with
    drift normalization to land on 100. Sound.
  - "Projected leads under this allocation" uses each DMA's historical CPL,
    which the in-component caption acknowledges. Good honest disclosure.
  - If everyone except the dragged row is locked, the change is refused
    silently — no toast/error. Minor UX issue.
- **Priority:** **P3** — works fine.

---

## Top fixes to ship next

### P0 (broken / misleading)
1. **CanvasMapPanel.tsx** — entire panel is baked Atlanta/Georgia demo data
   (storms, lead heatmap, "30 LEADS" label). It renders identically for every
   client audit and looks like real geographic intelligence. Either gate it
   behind a feature flag, label it as a sample/demo unmistakably, or wire it
   to the audit's actual `geo.regions` plus a real NCEI fetch.

### P1 (wrong type or wrong methodology — fix needed)
2. **DemographicsPanel.tsx** — three independent bugs:
   - Wrong chart type. Area chart implies continuous interpolation across
     non-continuous age brackets. Switch to a bar chart.
   - 18-24 bracket is silently dropped from the chart (`BRACKET_ORDER`
     excludes it). Add it back or document why.
   - Gradient stroke color is positional, not value-driven, so a $200-CPL
     25-34 bar renders green and a $20-CPL 65+ bar renders red. Use bar
     fills keyed to the bracket's `outcome` field.
3. **RecommendationCards.tsx — Current allocation donut**: the Converting /
   Mixed / Dead Weight buckets are computed with non-orthogonal rules and
   clamped with a magic 70% cap. The donut visualises a hidden methodology
   that overlaps between geo and creative waste. Either expose the math on
   the card or replace with a layout that doesn't require pretending the
   buckets are disjoint.
4. **ExecutiveSummary.tsx** — "Total Recoverable" headline only sums the top
   3 visible findings. When more than 3 findings exist, the user is being
   shown a smaller dollar value than the engine actually computed. Either
   sum across all findings or rename to "Top 3 Recoverable".
5. **CreativeAnalysisGrid.tsx** — the engine emits `creative.clickWinners` for
   Traffic-objective accounts so they don't get a misleading "no winners"
   empty state. The UI never renders that array. Add a "Best click-cost ads"
   section when `winners.length === 0 && clickWinners.length > 0`.

### P2 (minor polish)
6. **TimeSeriesScrubber.tsx** — Y-axis should start at 0 (cost charts must
   never zoom into the data range). Handle spend-only / zero-lead weeks
   distinctly so they don't render the same as no-data weeks.
7. **RecommendationCards.tsx — 30-Day CPL projection** — soften the caption
   under the line chart to acknowledge it's a projection, not a guarantee.
8. **PlacementsPanel.tsx** — `targetCpl` prop is accepted but never used.
   Either drop it or render it as a reference line on the bar chart (matching
   the pattern in `DemographicsPanel`).
9. **InteractiveFunnelExplorer.tsx** — stage 0 selection should disable the
   slider (the slider does nothing). "Recovered spend value" copy implies
   savings; it's actually a value calculation — clarify.
10. **DevicesPanel.tsx** — donut and table use different color systems
    (device-type vs score-status). Add a small disambiguation note or align
    palettes.
11. **TimeOfDayPanel.tsx** — $0-spend hours should be visually distinct
    (transparent or dashed border) from low-spend hours. CPL under $1
    collapses to "$0" in the cell — use 2 decimal places for sub-$1.
12. **TrackingFailuresPanel.tsx** — distinguish "no lead campaigns ran" from
    "0 broken". Mark heuristic dollar impacts as estimates.

### P3 (works fine)
- `FunnelLeakageChart.tsx`, `GeographicHeatmap.tsx`, `BenchmarkStatus.tsx`,
  `KPISnapshot.tsx`, `AuditRibbon.tsx`, `GeoBudgetReallocator.tsx`,
  `ExecutiveSummary.tsx` (other than the headline-sum bug above).
