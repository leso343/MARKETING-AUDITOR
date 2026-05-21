# Back-End QA Pass

Re-verification of the engine, parsers, API routes, and deploy-safe
guards. This pass found no actionable defects: the
verify-audit-reconcile script passes, the parser edge cases are
covered, and every DB/auth caller correctly short-circuits when the
relevant env is unset.

## Reconciliation

`npx tsx scripts/verify-audit-reconcile.ts` against
`public/csvs/take-charge-roofing/`:

```
✓ totalSpend           fs=3137.11  db=3137.11
✓ totalLeads           fs=31       db=31
✓ blendedCpl           fs=101.2    db=101.2
✓ geoTotalSpend        fs=3092.27  db=3092.27
✓ creativeCount        fs=14       db=14
✓ demoCount            fs=6        db=6
```

### Manual checks against the raw CSVs

| Metric | Raw CSV expected | Engine actual |
|--------|-------------------|---------------|
| Total spend (campaigns) | $3,137.11 | $3,137.11 |
| Total leads (`leadgen|pixel_lead` Result indicators) | 31 | 31 |
| Total link clicks (campaigns) | 1,614 | matches CTR×Impr derivation |
| Total impressions | 78,601 | matches |
| Blended CPL ($3137.11 / 31) | $101.20 | $101.20 |
| Blended CPC ($3137.11 / 1614) | $1.9437 | matches |
| Blended CTR (1614 / 78601 × 100) | 2.053% | matches |
| Blended CPM ($3137.11 / 78601 × 1000) | $39.91 | matches |
| Per-DMA spend total (breakdowns.csv) | $3,092.27 (Atlanta $3070.96, Greenville $21.31) | $3,092.27 |
| Per-DMA leads total | 30 (breakdown excludes pixel_lead) | matches |
| Age bracket leads sum (max(Leads, leadgen Results)) | 31 | 31 |
| Gender bracket leads sum | 31 | 31 (same total via different axis) |
| Creative count (unique ad names) | 14 | 14 |
| Tracking failures (lead campaigns with $>0, leads=0) | 1 ("Lead Forms" $150.61) | 1 |

Note: the engine's "blended CPL" denominator is 31, including the
single `fb_pixel_lead` result on the "LP Different Audience Testing"
campaign. Earlier manual analyses using
`startswith("actions:leadgen")` undercounted by 1; the engine's
`/leadgen|lead|pixel_lead/i` regex is the correct interpretation.

## Parser edge cases (`parseMetaCsv.toNumber`)

Verified via ad-hoc tsx script against `engine/parsers/metaAdsCsv.ts`:

```
toNumber("")              -> null   OK
toNumber(null)            -> null   OK
toNumber(undefined)       -> null   OK
toNumber("—")             -> null   OK
toNumber("-")             -> null   OK
toNumber("N/A")           -> null   OK
toNumber("null")          -> null   OK
toNumber("$1,234.56")     -> 1234.56  OK   (currency + thousands sep)
toNumber("1,234,567.89")  -> 1234567.89  OK
toNumber("1,234")         -> 1234   OK   (3-digit group)
toNumber("1,2")           -> null   OK   (not a valid thousands group)
toNumber("12.5%")         -> 12.5   OK
toNumber("  42  ")        -> 42     OK   (trim)
toNumber("€99.99")        -> 99.99  OK   (€/£/¥ stripped)
toNumber("abc")           -> null   OK
toNumber("0")             -> 0      OK
toNumber("-5.5")          -> -5.5   OK
```

The previous bug where the comma char-class ate decimal commas
(`"1,2" → 12`) was fixed in tier-2.5 — the parser now only strips
commas that are followed by exactly 3 digits and a word boundary.

## API routes

Source-level audit:

- `app/api/audit/[client]/pdf/route.ts` — dynamically imports
  `puppeteer` in dev, falls back to `puppeteer-core` + `PUPPETEER_EXECUTABLE_PATH`,
  uses `@sparticuz/chromium-min` in prod. Clear error messages.
- `app/api/clients/route.ts`, `app/api/clients/[slug]/csvs/route.ts`,
  `app/api/agency/route.ts`, `app/api/billing/checkout/route.ts` — all
  pre-check `authEnabled && dbAvailable` and return a 503-style
  "feature disabled" JSON before touching the DB.
- `app/api/auth/[...nextauth]/route.ts` — re-exports the shimmed
  handler when `AUTH_SECRET` is unset (returns 503 "Auth disabled").

## DB / Auth deploy-safe paths

- `lib/db.ts` — `dbAvailable` flag plus a thenable Proxy stub. Every
  drizzle method (`select / from / where / limit / insert / values /
  set / delete`) returns a chain that resolves to `[]`. Callers in
  `lib/access.ts` all pre-check `dbAvailable`.
- `auth.ts` — `authEnabled` flag. When `AUTH_SECRET` is unset:
  `auth()` resolves to `null`, `signIn()` throws a clear error,
  `handlers.GET/POST` 503.
- `middleware.ts` — `AUTH_ENABLED` controls whether the NextAuth
  middleware runs or pass-through.
- `app/admin/layout.tsx` — renders an "Admin disabled" notice instead
  of redirecting (which previously looped to /login). No admin
  children render when auth/DB are unavailable.

## Verdict

No code changes required for BE QA. The engine reconciles, parser
edge cases are covered, and every code path that touches DB or auth
short-circuits cleanly when the relevant env is missing. This summary
commit documents the audit trail.
