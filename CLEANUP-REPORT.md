# Cleanup & De-duplication Report

Branch: `claude/cleanup-and-dedup`
Base:   `claude/tier-3-deploy-safe`
Scope:  Codebase cleanup only — no new features, no file structure changes.

## Verification

After every commit:
* `tsc --noEmit` — clean
* `next build` — clean, all 22 routes compile
* `tsx scripts/verify-audit-reconcile.ts` — **3137.11 spend / 31 leads / blended CPL $101.20** via both `runAudit` (filesystem) and `runAuditFromFiles` (in-memory) paths.
* `npm run engine:test` — same reconciliation through the full CLI engine.

---

## Commits

### 1. `cleanup: remove unused exports flagged by ts-prune`
Three genuinely-unused exports detected by `ts-prune` (after filtering Next.js framework-required exports like `default`, `metadata`, route handlers `GET/POST`, etc.):

| Symbol                   | File                              |
|--------------------------|-----------------------------------|
| `dbInitError`            | `lib/db.ts`                       |
| `DB` (type alias)        | `lib/db.ts`                       |
| `parseUploadedCsvInMemory` | `engine/parsers/uploadedCsv.ts` |

Removed `dbInitError` also let us drop the now-orphan `initError` local. Removing `parseUploadedCsvInMemory` made the `Papa` and `classify` imports dead — those went too.

**Files changed:** 2  &nbsp; **Lines:** −22

### 2. `cleanup: drop unused locals, params, imports across components (8 spots)`
Detected via `tsc --noUnusedLocals --noUnusedParameters`:

| Item                                | File                                           |
|-------------------------------------|------------------------------------------------|
| `t` from `useLang()` destructure    | `app/components/audit/KPISnapshot.tsx`         |
| `ArrowDown` import                  | `app/components/audit/RecommendationCards.tsx` |
| `targetCtr` param                   | `app/components/audit/RecommendationCards.tsx` |
| `useRef` import                     | `app/components/visualizers/GeoBudgetReallocator.tsx` |
| `w` map param (renamed `_w`)        | `app/components/visualizers/TimeSeriesScrubber.tsx` |
| `useEffect` import                  | `app/context/ReportContext.tsx`                |
| `BREAKDOWN_HINTS` constant          | `engine/parsers/metaAdsCsv.ts`                 |
| `STATUS_COLORS` constant            | `engine/report/generator.ts`                   |
| `req` param (renamed `_req`)        | `app/api/clients/[slug]/csvs/route.ts`         |

`targetCtr` left on the `Props` interface as optional so the caller still type-checks.

**Files changed:** 8  &nbsp; **Lines:** +6 / −20

### 3. `cleanup: consolidate duplicate round/sum helpers into engine/analyses/_shared.ts`
**Biggest duplication find.** Six analysis files each carried byte-identical local copies of:
```ts
function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
```
Two of them (`spendEfficiency.ts`, `funnelLeakage.ts`) also duplicated `sum()`.

- New: `engine/analyses/_shared.ts` exporting `round` and `sum`.
- Removed: 6 local `round` definitions, 2 local `sum` definitions.
- Added: `import { round, sum } from "./_shared"` where needed.

**Files changed:** 7  &nbsp; **Lines:** +24 / −30

### 4. `cleanup: drop unused .status-warn CSS rule`
Only `.status-pill`, `.status-ok`, and `.status-critical` are referenced from TSX. `.status-warn` was orphan styling from an earlier draft of the status taxonomy.

**Files changed:** 1  &nbsp; **Lines:** −1

### 5. `cleanup: tighten uploadedCsv.ts docstring (drop stale classify rationale)`
The header described the `classify + Papa.parse minimal parser` design that commit #1 removed. Updated to describe what the file actually does (tempfile → `parseMetaCsv` delegation).

**Files changed:** 1  &nbsp; **Lines:** +3 / −14

---

## Categories investigated but no action taken

### Duplicate utilities (toNumber / formatCurrency / parseCsv etc.)
* `toNumber` — only one implementation (`engine/parsers/metaAdsCsv.ts`). Not duplicated.
* `formatCurrency` / `formatPercent` / `formatCpl` — **no helper exists**. The codebase uses inline `.toLocaleString('en-US', ...)` calls in ~30 places. Consolidating them into a util would be net-good but touches a lot of files (UI + engine + report HTML), risk-reward bad for a cleanup pass. Documented for a future refactor.
* `parseCsv*` — one parser per concern (`parseMetaCsv` for filesystem, `parseUploadedCsv` for in-memory). Not duplicates — different inputs.
* `isLeadObjective` — three copies (`funnelLeakage`, `spendEfficiency`, `trackingFailures`). Bodies differ by signature (`trackingFailures` adds `name` arg and matches `onsite_conversion.lead`). Not safe to consolidate without changing classification behavior.
* Recharts `DarkTooltip` / `CplTooltip` — same visual shell, different inner content. Consolidation would require render-prop pattern; over-engineering for cleanup.

### npm dependencies (`depcheck` review)
`depcheck` flagged `@tailwindcss/postcss`, `@types/react-dom`, `tailwindcss` — all false positives (used by `postcss.config.mjs` and `next-env.d.ts`).
Manually verified `leaflet`, `@sparticuz/chromium-min`, `puppeteer-core`, `bcryptjs`, `@libsql/client`, `drizzle-orm`, `next-auth`, `lucide-react`, `recharts`, `commander`, `papaparse` — all referenced (some via dynamic `import()`). **No dependency removals.**

### `console.log` audit
All `console.log`s are in `engine/index.ts` CLI output (intended user-facing). All `console.error` and `console.warn` calls are on legitimate error paths (parser failures, DB init failure, etc.). **Nothing removed.**

### CSS audit
21 declared classes in `app/globals.css`; one unused (`.status-warn`, removed). `.print-mode*` rules are actively used by the PDF export route (`?print=true` query string in `AuditDashboard.tsx`). Kept.

### Type cleanups (`any` types)
Five `any` annotations were found, all legitimate:
* `middleware.ts:58` — typed `any` for conditional NextAuth export shape.
* `RecommendationCards.tsx:142,158` and `DemographicsPanel.tsx:46` — Recharts tooltip payload (awkward upstream typings).
* `app/api/audit/[client]/pdf/route.ts:28` — dynamic puppeteer module shape.

`as unknown as` casts are all in dynamic import / Drizzle stub / NextAuth-fallback land. Each one carries a rationale comment. **No changes.**

---

## TODO / FIXME items intentionally preserved

| Location | Type | Reason |
|----------|------|--------|
| `db/schema.ts:96` | `// TODO: integrate Stripe — populate on checkout webhook.` | Intentional billing TODO; Stripe webhook is a future task. |
| `app/api/billing/checkout/route.ts:77` | `// TODO: integrate Stripe.` | Same. The whole `/api/billing/checkout` route is the friendly placeholder this TODO references. |
| `app/api/billing/checkout/route.ts:12` (in JSDoc) | `...returns a friendly TODO.` | Describes the current placeholder behaviour, not a real TODO. |
| `app/pricing/page.tsx:5` (in JSDoc) | `...returns a TODO message.` | Same — describes current placeholder. |

No `FIXME` / `XXX` / `HACK` markers were found anywhere in the codebase.

---

## Structural inconsistencies noted (no action — out of scope)

Per the task constraint *"no renames, no big moves"*, these are recorded only:

* **Helpers split across `lib/`, `db/`, `engine/`** — `lib/db.ts` (Drizzle client), `lib/access.ts` (auth helpers), `db/schema.ts` (Drizzle schema). Two-letter directory names mixing concerns; a future pass might consolidate under `lib/db/` and `lib/auth/`.
* **Legacy root scripts** — `analyze_creatives.js`, `sna_engine.js`, `verify_metrics.mjs`, `analyze_raw_csvs.js`, `campaign_report.html`, `index.html`, `interactive_audit.html` sit at the repo root. They predate the Next.js port and are unreferenced from the current TypeScript code. Only `verify_metrics.mjs` is mentioned (in `WIRING-VERIFICATION-REPORT.md`). Removing them is the next obvious cleanup but is owner-call: someone may still be running them as dev tools.
* **`engine/runAudit.ts` vs `engine/runAuditFromFiles.ts`** — two near-identical orchestrators (one for filesystem CSVs, one for in-memory). The reconciliation script exists precisely to keep them in sync. A future pass could DRY them into one orchestrator that takes a `Source<ParsedFile[]>` abstraction.
* **Three separate analyses define `isLeadObjective`** — see note above; signatures diverged on purpose, so the duplication is acceptable for now.

---

## Net diff

| Category                  | Files | Lines |
|---------------------------|------:|------:|
| Dead exports              | 2     | −22   |
| Dead locals/params/imports| 8     | −14   |
| Round/sum consolidation   | 7     | −6    |
| Unused CSS                | 1     | −1    |
| Stale docstrings          | 1     | −11   |
| **Total**                 | **19**| **−54** |
