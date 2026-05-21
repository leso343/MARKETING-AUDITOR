# Tier 3 — Deploy & Multi-tenant

Standalone branch built off `main`. Designed to be merged **after** Tier 1 / Tier 2 / Tier 2.5 in the four-PR sequence:

1. Tier 1 — CPL fix + Puppeteer PDF export
2. Tier 2 — Visualizers + copy bank + demographics-Leads fix + creative dedup
3. Tier 2.5 — Bug-hunt fixes (per-client PDF link, divide-by-zero liveCpl, NaN audit query params, decimal-comma toNumber, BreakdownRow fields, trackingFailures Result indicator, blendedCpl link-clicks)
4. **Tier 3 (this branch)** — Vercel deploy prep, client onboarding, NextAuth multi-tenant, billing stub

Tier 3 makes **no engine-internals changes** — it adds only sibling files (`engine/parsers/uploadedCsv.ts`, `engine/runAuditFromFiles.ts`) so the demographics / creative-dedup / parser fixes from Tier 2 / 2.5 flow through cleanly when merged.

## What's added

### Deploy & infrastructure
- `next.config.ts`: `serverExternalPackages` extended with `puppeteer-core`, `@sparticuz/chromium-min`, `bcryptjs`, `@prisma/client`, `prisma`. The puppeteer entries de-dup with Tier 1's additions at merge time. `outputFileTracingIncludes` covers both `public/csvs/**` and `data/csvs/**`.
- `.env.example`: documents `AUTH_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, Stripe placeholders.
- `vercel.json`: unchanged (already correct for Next on Vercel).
- `.gitignore`: ignore `data/dev.db`, dev uploads, runtime logo writes.

### Database (Drizzle ORM + libsql)
- `db/schema.ts`: `agencies`, `users`, `clients`, `csv_files`, `subscriptions`.
- `db/migrations/0000_glorious_ulik.sql`: initial schema.
- `lib/db.ts`: single Drizzle client. `DATABASE_URL=file:./data/dev.db` for dev, `DATABASE_URL=libsql://<turso-host>` + `DATABASE_AUTH_TOKEN=…` for prod (Turso). Postgres deploy: swap libsql driver to `drizzle-orm/postgres-js`.
- `drizzle.config.ts`: turso dialect.
- `scripts/seed.ts`: idempotent seed — Lester admin (`lesterortiz39@gmail.com`) + SNA Marketing agency + Take Charge Roofing client + free/trialing subscription.

### Authentication (NextAuth v5 / auth.js beta)
- `auth.config.ts`: edge-safe (no bcrypt) — used by `middleware.ts`.
- `auth.ts`: extends edge config with the Credentials provider (bcrypt + Drizzle lookup).
- `app/api/auth/[...nextauth]/route.ts`: handler.
- `middleware.ts`: redirects unauthenticated requests to `/login` (allow-list: `/login`, `/pricing`, `/api/auth/*`, static assets).
- `app/login/`: credentials sign-in form.
- `app/SessionProviderWrapper.tsx`: SessionProvider mounted in root layout.
- JWT sessions (no DB hit on every nav). `role` (admin|agency) + `agencyId` baked into the token at sign-in.

### Client onboarding
- `POST /api/clients` — create a client under the session user's agency.
- `GET/POST/DELETE /api/clients/[slug]/csvs` — upload, list, delete CSV exports. Multipart; upsert on `(clientId, filename)`.
- `app/admin/clients/` — list + NewClientForm.
- `app/admin/clients/[slug]/` — CSV checklist (5 expected exports) + UploadCsvForm + file table with delete.
- `app/audit/[client]/page.tsx` — rewritten to be DB-first (auth-gated via `getVisibleClientBySlug`), filesystem fallback for clients without uploads. The on-disk `public/csvs/take-charge-roofing/` dataset is intentionally not migrated to the DB so the **$3,137.11 / 31 leads** baseline reconciliation still works on a fresh install with only `npm run db:seed`.
- `app/page.tsx` — home tile grid now DB-driven (hardcoded "Take Charge Roofing" tile gone; lists clients visible to the session user).
- `app/setup/page.tsx` — hardcoded `clientSlug="take-charge-roofing"` replaced with a `ClientLogoSection` that takes any slug.

### Multi-tenant + white-label
- `lib/access.ts`: `requireUser` / `requireAdmin` / `listVisibleClients` / `getVisibleClientBySlug` / `listClientCsvs`.
- Roles: `admin` (sees all clients) and `agency` (sees their agency's clients only).
- `app/admin/settings/`: agency name + logo URL + primary color editor (PATCH `/api/agency`).
- `app/admin/agencies/`: admin-only list of all agencies.
- Home page header renders `agency.name` + `agency.logoUrl` + `agency.primaryColor` when an agency user is logged in. The audit page falls back to the agency's `logoUrl` when `public/logos/agency.*` isn't present.

### Billing (stub, no Stripe yet)
- `/pricing` — public page. Free trial / Pro $99 / Agency $299 cards. Subscribe buttons POST to `/api/billing/checkout`.
- `/api/billing/checkout` — stub: records the chosen plan against the agency's Subscription row, returns a friendly TODO message. `schema.subscriptions` already has `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd` columns. Inline `// TODO: integrate Stripe` comment in the route shows the exact `stripe.checkout.sessions.create` call.

### Engine (additive only)
- `engine/parsers/uploadedCsv.ts` — parse Meta CSV from in-memory text via tempfile + `parseMetaCsv`. Touches no existing files.
- `engine/runAuditFromFiles.ts` — sibling of `runAudit()` that consumes uploaded CSV blobs. Same `AuditResult` shape; same six analyses. The legacy `engine/runAudit.ts` and `engine/parsers/metaAdsCsv.ts` are NOT modified, so Tier 2.5's `toNumber` decimal-comma fix and `BreakdownRow` field additions flow through cleanly at merge time.

### Scripts
- `npm run db:generate` — generate Drizzle migrations from `db/schema.ts`.
- `npm run db:push` — apply schema to the configured DB.
- `npm run db:studio` — Drizzle Studio.
- `npm run db:seed` — seed Lester admin + SNA Marketing + Take Charge Roofing.

## Reconciliation

The dashboard for `take-charge-roofing` produces the same numbers via both code paths:

```
  ✓ totalSpend    fs=3137.11  db=3137.11
  ✓ totalLeads    fs=31       db=31
  ✓ blendedCpl    fs=101.20   db=101.20
  ✓ geoTotalSpend fs=3092.27  db=3092.27
  ✓ creativeCount fs=60       db=60
  ✓ demoCount     fs=6        db=6
```

(Run `npx tsx scripts/verify-audit-reconcile.ts` to verify in dev.)

## Hardcoded "Take Charge Roofing" audit

`grep -rn "Take Charge\|take-charge-roofing"` across the diff returns:
- `public/csvs/take-charge-roofing/` — the dataset itself (kept; powers the filesystem-fallback reconciliation).
- `scripts/verify-audit-reconcile.ts` — the dev verification script.
- `scripts/seed.ts` — seeds it as a Client record under SNA Marketing.
- `engine:test` npm script — runs the engine CLI against the same on-disk dataset for parity checking.

No UI references remain. The home tile, the audit page, and the setup page all read the slug dynamically.

## Merge-conflict expectations

When merging Tier 3 on top of (Tier 1 + Tier 2 + Tier 2.5):
- `next.config.ts` — both sides add `serverExternalPackages` entries. Take the union.
- `package.json` / `package-lock.json` — both sides add deps. Take the union; re-run `npm install`.
- `app/page.tsx` — Tier 3 rewrites it. Take Tier 3's version (the hardcoded tile is intentionally removed). Visual polish from prior tiers will need to be re-applied if it touched the home page header.
- `app/audit/[client]/page.tsx` — Tier 3 rewrites this too. Take Tier 3's version; Tier 2.5's per-client PDF link is preserved through dashboard props (not via this file).
- `app/setup/page.tsx` — Tier 3 only swaps the client-logo block; mid-file Tier 2 / 2.5 changes should not collide.
- `engine/*` — Tier 3 adds new files only. No conflicts.

## Deploy

See updated README → **Deploy** section.
