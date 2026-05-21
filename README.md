# SNA Forensic Marketing Auditor

Forensic Meta Ads audits with a live-tuneable dashboard. Drop the five Meta Ads Manager CSV exports, get a forensic breakdown of funnel leakage, tracking failures, geographic waste, creative deadweight, and dollar-quantified opportunities.

> **Tier 3 (this branch)** adds multi-tenant auth, a client onboarding flow, white-label branding, a Vercel deploy path, and a Stripe-ready billing stub. See [`TIER-3-CHANGES.md`](./TIER-3-CHANGES.md).

## Quickstart (local dev)

```bash
# 1. Clone + install
git clone https://github.com/leso343/MARKETING-AUDITOR.git
cd MARKETING-AUDITOR
npm install

# 2. Local env
cp .env.example .env
# Edit .env — at minimum, replace AUTH_SECRET with `openssl rand -base64 32`

# 3. Initialize SQLite dev DB
npm run db:push        # apply schema
npm run db:seed        # seed Lester admin + SNA Marketing + Take Charge Roofing

# 4. Dev server
npm run dev            # http://localhost:3000

# Default login (CHANGE IMMEDIATELY)
#   email:    lesterortiz39@gmail.com
#   password: changeme
```

After login, the home dashboard lists the seeded `Take Charge Roofing` client. Clicking through to its audit page renders the forensic dashboard against the CSVs in `public/csvs/take-charge-roofing/` — Total Spend **$3,137.11**, Tracked Leads **31**, Blended CPL **$101.20**.

To add a new client: `/admin/clients` → fill the form → upload the five Meta exports on the client detail page.

## Architecture

| Layer | What |
| --- | --- |
| **Engine** (`engine/`) | TypeScript modules. `parsers/metaAdsCsv.ts` parses Meta's CSV exports. Six analyses (`analyses/*.ts`) score the data. `runAudit.ts` reads from disk; `runAuditFromFiles.ts` (Tier 3) reads from DB-stored uploads. |
| **App** (`app/`) | Next.js 15 App Router. `/audit/[client]` renders the dashboard. `/admin/*` is the multi-tenant management UI. |
| **Auth** | NextAuth v5 / auth.js (Credentials provider, bcrypt, JWT sessions). Edge-safe middleware. |
| **DB** | Drizzle ORM over libsql. SQLite file in dev, Turso (or Postgres) in prod. |
| **Reports** | `engine/report/generator.ts` for the standalone HTML export. The Next dashboard has its own componentized renderer (`app/components/audit/*`). |

## Roles

- `admin` — sees all clients across all agencies. Lester is seeded as admin.
- `agency` — sees only their own agency's clients. Edits their own branding.

## Required Meta exports per client

When uploading via `/admin/clients/[slug]`, the page checks for these five filenames:

| Filename | Contents |
| --- | --- |
| `campaigns.csv` | Campaign-level metrics |
| `ads.csv` | Ad-level metrics + Quality / Engagement / Conversion rankings |
| `breakdowns.csv` | DMA / region geographic breakdown |
| `breakdown_age_gender.csv` | Age × gender breakdown |
| `breakdown_placement.csv` | Placement breakdown (feed / reels / story / etc.) |

The parser identifies file type by inspecting headers, not filename — but using these conventional names makes the checklist UI light up green when a file is present.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | Next lint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run engine:test` | Run the engine CLI against the on-disk Take Charge Roofing dataset (produces `reports/take-charge-roofing.html`) |
| `npm run db:generate` | Generate a new Drizzle migration from `db/schema.ts` |
| `npm run db:push` | Apply schema to the configured DB |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed admin + SNA Marketing + Take Charge Roofing |

## Deploy

### Vercel + Turso (recommended)

1. **Push the repo to GitHub** (the Tier 1 → Tier 2 → Tier 2.5 → Tier 3 PRs in order).
2. **Create a Turso DB**: `turso db create marketing-auditor && turso db tokens create marketing-auditor`. Note the DB URL and auth token.
3. **Import the project on Vercel** (`vercel.com/new`). Framework: Next.js (auto-detected).
4. **Add env vars** in the Vercel project settings:
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel URL (e.g. `https://marketing-auditor.vercel.app`)
   - `DATABASE_URL` — `libsql://<your-db>.turso.io`
   - `DATABASE_AUTH_TOKEN` — the Turso token
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — only used if you run the seed script during build
5. **First-deploy seeding**: run `npm run db:push && npm run db:seed` once locally pointed at the Turso DB (set the env vars in `.env.local` for that run), or add a one-shot deploy hook.
6. **Deploy**.

### Vercel + Postgres (e.g. Neon)

Drizzle has a Postgres driver. Two small changes:

```ts
// lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

```ts
// drizzle.config.ts → dialect: "postgresql"
```

Then `npm install postgres` and regenerate migrations with `npm run db:generate` (the SQL output differs slightly). Use Neon (free tier) or Vercel Postgres as the host.

### Puppeteer PDF route on Vercel

The PDF export route ships in Tier 1 (`app/api/audit/[client]/pdf/route.ts`). It uses `puppeteer-core` + `@sparticuz/chromium-min` to run a headless Chromium inside the Vercel serverless runtime. The `serverExternalPackages` entries in `next.config.ts` (added by Tier 3) keep Next from trying to bundle those for the client. No further config needed.

## Billing

`/pricing` is public. Subscribe buttons currently hit `/api/billing/checkout` which records the chosen plan against `schema.subscriptions` and returns a TODO message. To wire Stripe:

1. `npm install stripe`
2. Replace the body of `app/api/billing/checkout/route.ts` with the `stripe.checkout.sessions.create` call (the inline `// TODO: integrate Stripe` comment shows the exact call).
3. Add `app/api/billing/webhook/route.ts` to listen for `checkout.session.completed` / `customer.subscription.updated` and patch the Subscription row.
4. Add Stripe price IDs to env (`STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_AGENCY`).

## Skipped scope

- **Meta Marketing API integration** is intentionally out of Tier 3. The audit reads CSV exports only. The API path is deferred until Lester completes Facebook Developer access.

## License

Private — internal SNA Marketing tool.

## Deploying without DB/auth (legacy single-tenant mode)

The Tier 3 multi-tenant features (NextAuth, Drizzle/libsql, admin UI, white-label branding) all degrade gracefully when their env vars are missing. This means you can deploy this branch to Vercel with **zero env vars** and the dashboard still works against the on-disk CSV bundles under `public/csvs/<slug>/`.

The mode is auto-detected at runtime:

| Env var       | Set                                | Unset (legacy mode)                                                                                                  |
| ------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`  | Middleware gates routes; `/login` works; `auth()` returns a session. | `middleware.ts` is a pass-through; `auth()` returns `null`; `/login` shows a "auth disabled" notice; `/admin/*` redirects to `/`. |
| `DATABASE_URL` | Drizzle/libsql client wired; clients listed from DB; uploads stored as rows in `csv_files`. | `lib/db` exports a stub whose queries resolve to `[]`; home page falls back to scanning `public/csvs/*/`; `/api/clients/*`, `/api/agency`, `/api/billing/checkout` return 503. |

In legacy mode the take-charge-roofing baseline still reconciles to **$3,137.11 / 31 leads** because the audit page falls through to its filesystem path. See [`TIER-3-DEPLOY-SAFE-CHANGES.md`](./TIER-3-DEPLOY-SAFE-CHANGES.md) for the full graceful-degrade matrix.

### Enabling multi-tenant on Vercel

Set both `AUTH_SECRET` (via `openssl rand -base64 32`) and `DATABASE_URL` (libsql/Turso connection string), redeploy, and the admin UI, sign-in, and per-agency branding light up. See the Vercel + Turso section above for the full setup.
