# Tier 3 Deploy-Safe Changes

Tier 3 introduced NextAuth v5 middleware + a libsql Drizzle DB layer. When deployed to Vercel without `AUTH_SECRET` / `DATABASE_URL` set, the original Tier 3 code crashed every request with a 500 (NextAuth threw at edge init, libsql threw on first query).

This branch (`claude/tier-3-deploy-safe`) wraps every Tier 3 entrypoint with env-var-aware guards so the app **gracefully degrades to the Tier 2/2.5 filesystem-only experience** when env vars are missing, and **runs the full Tier 3 multi-tenant flow unchanged** when both env vars are present.

> **No Tier 1 / Tier 2 / Tier 2.5 code was changed.** Only Tier 3 surfaces and the home page (`app/page.tsx`) were touched, plus a new admin-layout notice and updated `.env.example` / `README.md`.

## The graceful-degrade matrix

| Env var        | Set → behavior                                                                                  | Unset → behavior                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`  | `middleware.ts` gates routes; `/login` works; `auth()` returns a real session; admin pages OK. | `middleware.ts` is a pass-through (no NextAuth init); `auth()` resolves to `null`; `/login` shows a notice; `/admin/*` redirects to `/`. |
| `DATABASE_URL` | Drizzle/libsql client wired; admin UI lists DB-backed clients; uploads write to `csv_files`.   | `lib/db` exports a stub whose query chain resolves to `[]`; home page scans `public/csvs/*/`; `/api/clients/*`, `/api/agency`, `/api/billing/checkout` return 503. |

Both env vars are independent. The four cells of the matrix all boot cleanly:

| `AUTH_SECRET` | `DATABASE_URL` | Mode                                                              |
| ------------- | -------------- | ----------------------------------------------------------------- |
| set           | set            | Full Tier 3 — multi-tenant, DB-backed, white-labeled              |
| set           | unset          | Auth gate works but DB calls no-op; admin pages effectively empty |
| unset         | set            | No-auth dashboard; DB available but unused (home scans FS)        |
| unset         | unset          | Legacy single-tenant filesystem mode (Tier 2.5 behavior)          |

## File-by-file guard summary

### `lib/db.ts`
- Reads `DATABASE_URL` once at module load (no default — undefined when unset).
- When `DATABASE_URL` is unset, `createClient()` is **not** called.
- When `DATABASE_URL` is set but `createClient()` throws, the error is caught and logged (no rethrow).
- Exports `dbAvailable: boolean` and `dbInitError: unknown` so callers can branch.
- When the real client is null, exports a **Proxy-based stub** whose property accesses return chainable callables and `.then` resolves to `[]`. Awaiting any drizzle chain (`db.select().from(...).where(...).limit(N)`, `db.insert(...).values(...)`, `db.update(...).set(...)`, `db.delete(...).where(...)`) returns `[]` and never throws.

### `auth.ts`
- Exports `authEnabled = !!process.env.AUTH_SECRET`.
- When `authEnabled` is true: `NextAuth({...})` is called with the Credentials provider as before. The provider also checks `dbAvailable` before hitting `db.select(...users)` so login fails cleanly (returns `null`) if DB is missing.
- When `authEnabled` is false: `NextAuth(...)` is **not** called. Shims are exported:
  - `auth()` resolves to `null` (no session).
  - `signIn()` throws a clear "auth disabled" error.
  - `signOut()` resolves to `undefined` (no-op).
  - `handlers.GET` / `handlers.POST` respond `503` with a JSON message.

### `auth.config.ts`
- Unchanged. It's already pure config (no Node-only imports, no `secret` read), so it doesn't crash on edge import even with AUTH_SECRET unset.

### `middleware.ts`
- Reads `AUTH_SECRET` at module load.
- When set, calls `NextAuth(authConfig).auth(handler)` and exports it as the default middleware (original Tier 3 gating).
- When unset, exports a **no-op middleware** that calls `NextResponse.next()` for every request. This is critical because middleware runs on the Vercel edge runtime and the old code threw "missing secret" before the first byte of any response.

### `lib/access.ts`
- Every helper now short-circuits when `!authEnabled || !dbAvailable`:
  - `tryGetUser()` (new) — returns `null` instead of redirecting.
  - `requireUser()` — when `!authEnabled`, redirects to `/` instead of `/login` (since `/login` can't authenticate anything in this mode).
  - `requireAdmin()` — unchanged on top of `requireUser`.
  - `getCurrentAgency()`, `listVisibleClients()`, `getVisibleClientBySlug()`, `getAgencyById()` — all return `null` / `[]` when auth or DB is off.
  - `listClientCsvs()` — returns `[]` when DB is off (auth-agnostic).

### `app/page.tsx`
- Detects `!authEnabled || !dbAvailable` at the top of the server component.
- In that mode, renders a **filesystem-only home**: scans `public/csvs/*/` directories, reads optional `client.json` for display metadata, and shows the same tile grid. No sign-out button, no admin/pricing links, no agency branding.
- A small amber banner ("Legacy mode — set AUTH_SECRET to enable") tells the operator what's needed.
- When both env vars are set, the original DB-driven multi-tenant home renders unchanged.

### `app/audit/[client]/page.tsx`
- All three DB-touching calls (`getVisibleClientBySlug`, `listClientCsvs`, `getAgencyById`) are now wrapped in a `safe<T>()` helper that catches and logs any DB error and returns `null` / `[]`.
- The existing filesystem fallback (`fs.existsSync(public/csvs/<slug>/)`) is reached when `dbClient` is null **for any reason** (auth off, DB off, transient libsql failure, or the client genuinely doesn't exist in DB).
- The take-charge-roofing baseline (`public/csvs/take-charge-roofing/`) reconciles to **$3,137.11 / 31 leads** in all four matrix cells.

### `app/admin/layout.tsx`
- Detects `!authEnabled || !dbAvailable` at the top.
- Renders a "Multi-tenant mode disabled" notice with a link back to `/`. (In practice the page components' own `requireUser()` calls usually redirect first, so this is a defensive backstop.)

### `app/login/page.tsx`
- When `!authEnabled`, shows a "auth disabled — set AUTH_SECRET" notice instead of `<LoginForm />`. The login form would otherwise hit our shimmed `signIn()` which throws.

### API routes
| Route                            | Guard                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/api/auth/[...nextauth]`        | Uses shimmed `handlers` from `auth.ts` → 503 when auth off.                                    |
| `/api/clients` (POST)            | 503 when `!authEnabled \|\| !dbAvailable`.                                                     |
| `/api/clients/[slug]/csvs`       | 503 on GET/POST/DELETE when `!authEnabled \|\| !dbAvailable`.                                  |
| `/api/agency` (PATCH)            | 503 when `!authEnabled \|\| !dbAvailable`.                                                     |
| `/api/billing/checkout` (POST)   | 503 when `!authEnabled \|\| !dbAvailable`.                                                     |
| `/api/upload-logo` (POST)        | Unchanged — pure filesystem, no auth/DB dependency. Works in legacy mode.                      |
| `/api/audit/[client]/pdf`        | Unchanged — Tier 1 puppeteer route, no auth/DB dependency.                                     |
| `/api/get-meta-config`, `/api/save-meta-config`, `/api/test-meta-connection` | Unchanged — pure filesystem (`config/meta.json`).             |

## Verification

### Legacy mode (no `.env`, no `.env.local`)
- `npm run build && npm run start` boots cleanly.
- `GET /` → home renders with the on-disk Take Charge Roofing tile.
- `GET /audit/take-charge-roofing` → audit dashboard renders; KPI shows **$3,137.11 / 31 leads**.
- `GET /admin/clients` → redirects to `/` (legacy home), no 500.
- `POST /api/billing/checkout` → 503 with explanatory JSON.

### Full multi-tenant (`AUTH_SECRET` + `DATABASE_URL=file:./data/dev.db`)
- `npm run db:push && npm run db:seed && npm run build && npm run start`.
- Sign-in works at `/login`; admin pages reachable; CSV uploads land in `csv_files`.

## Conventions

- All deploy-safe changes are tagged with a "─── Deploy-safe guard (Tier 3-deploy-safe) ───" doc block at the top of the touched file, so Lester (and future Claude runs) can grep for them.
- No new dependencies were added. No Tier 1/2/2.5 files were changed.
- No new features beyond the graceful-degrade path were added.
