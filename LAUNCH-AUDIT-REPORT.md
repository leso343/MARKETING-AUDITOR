# 🔴 LAUNCH AUDIT REPORT — Blank Page Audits

**Repo:** [leso343/MARKETING-AUDITOR](https://github.com/leso343/MARKETING-AUDITOR)
**Audited HEAD:** `d22810f` ("Add show/hide password toggle on login form") — newer than the `5472772` floor.
**Audit date:** 2026-05-23
**Audit mode:** No-mercy pre-launch pass. Audit-only. No code changed in this branch.

---

## Files Lester said might be unpushed — CONFIRMED unpushed

The following were NOT on `origin/main` at the audited commit and so are not covered by this report:

- `lib/email.ts`
- `lib/email-templates.ts`
- `lib/notifications.ts`
- `app/components/NotificationBell.tsx`
- `app/components/OnboardingWizard.tsx`
- `app/components/ClientLogo.tsx`
- `app/api/fetch-logo/route.ts` *(the SSRF candidate — could not audit)*
- `app/admin/clients/[slug]/ClientLogoUpload.tsx`

**Action:** push these (or confirm they were intentionally dropped) and request a second audit pass for them. The SSRF guard for `fetch-logo` in particular is unverifiable from the current main.

---

## Severity legend

- 🔴 **CRITICAL** — Must fix before launch. Security holes, plan-limit bypass, money-stealing risks, total broken core flows.
- 🟠 **HIGH** — Should fix before launch. Broken user flows that lose customers, billing weirdness, surfaces likely to embarrass you on a first demo.
- 🟡 **MEDIUM** — Fix soon after launch. Code quality, minor bugs, accessibility.
- 🟢 **LOW** — Polish & tech debt.

---

# 🔴 CRITICAL

## C-1. There is no signup endpoint. Customers literally cannot buy.

- **File:line** — entire app. Grep proof: `grep -rn "signup\|register" app/api` → zero results. `app/login/LoginForm.tsx:128` says *"No account? Contact admin."*. `app/pricing/PricingCard.tsx:73-82` shows free-tier CTA goes to `/login`, paid CTAs hit `/api/billing/checkout` which `return 401` for unauthed users and bounces to `/login?from=/pricing` — where the user cannot make an account.
- **What's wrong** — The pricing page sells "Start free trial" and "Get started" for Pro/Agency. The Stripe checkout flow requires `session.user.agencyId` (`app/api/billing/checkout/route.ts:89`). New visitors land on `/login`, see "Contact admin", and bounce. The only way a user exists is `npm run db:seed` or admin manually creating one through `/api/users`.
- **Why it matters** — You're about to "take real money from real customers" but the funnel terminates with "email lester to create your account." That's the no.1 launch blocker. Every $99/mo or $299/mo conversion in your funnel will hit a wall.
- **Suggested fix** — Build `/signup` (or `/get-started`) and `app/api/auth/signup/route.ts` that: (1) validates email + password ≥ 8 chars, (2) creates an `agency` (slug from email domain or random), (3) creates the user with role=`agency`, (4) creates a `subscriptions` row with `plan=free, status=trialing`, (5) signs them in via NextAuth `signIn("credentials")`. Replace "Contact admin" with a link to it on `LoginForm.tsx:138`, and route `PricingCard.tsx:43,73` ("Start free trial" / "Get started") at it instead of `/login`.

## C-2. `/api/upload-logo` lets ANY logged-in user overwrite ANY agency or client logo.

- **File:line** — `app/api/upload-logo/route.ts:38-70`.
- **What's wrong** — The route checks `session?.user` exists but never checks (a) `session.user.agencyId` matches the agency it's writing to, or (b) the `clientSlug` is owned by the caller's agency. `target === "agency"` writes to `public/logos/agency.<ext>` — a singleton path shared across the whole deploy, so any user clobbers every agency's logo. `target === "client"` writes `public/csvs/<safe(slug)>/logo.<ext>` for *any* slug, with no `getVisibleClientBySlug` check.
- **Why it matters** — Vandalism / brand sabotage across tenants. A paid Agency customer can replace a competitor's client logo on a shared deploy. Also: it deletes the old file before writing the new one (lines 52-53, 65-66), so the attacker can wipe legitimate logos by uploading and then deleting their own.
- **Suggested fix** — Require role-aware scoping: for `target === "agency"`, write under `public/logos/agencies/<session.user.agencyId>/agency.<ext>` and refuse if `!session.user.agencyId && session.user.role !== "admin"`. For `target === "client"`, call `getVisibleClientBySlug(clientSlug)` (from `lib/access.ts`) and return 403 if null. Also: this whole route is broken in production on Vercel anyway — see C-5.

## C-3. `os.tmpdir()` path traversal via attacker-controlled CSV filename in `parseUploadedCsv`.

- **File:line** — `engine/parsers/uploadedCsv.ts:30-32`. `const tmpPath = path.join(tmpDir, file.filename); fs.writeFileSync(tmpPath, file.content, "utf8");`
- **What's wrong** — `file.filename` originates from the browser's `File.name` (controlled by the client; see `app/api/clients/[slug]/csvs/route.ts:75` where it's passed straight through from `f.name`). `path.join("/tmp/audit-csv-AbC", "../../../../tmp/foo")` resolves to `/tmp/foo`. The user-uploaded CSV content is then written to that arbitrary location. Plus the **unique-filename constraint** on `(clientId, filename)` (db/schema.ts:81-82) lets you store names like `../../../../tmp/payload.sh` in the DB.
- **Why it matters** — Arbitrary file write within whatever the Node process can reach. On Vercel that's mostly `/tmp` (ephemeral), but it can clobber other tenants' in-flight CSV parses in the same instance. On a self-host deploy this is a remote arbitrary-write primitive.
- **Suggested fix** — Reject any filename containing `/`, `\`, `..`, or NUL at the upload boundary in `app/api/clients/[slug]/csvs/route.ts` (before line 75 inside the for loop). Also harden `engine/parsers/uploadedCsv.ts:30` to `path.join(tmpDir, path.basename(file.filename))`.

## C-4. Plan-limit bypass: race condition lets free-tier users create unlimited clients.

- **File:line** — `app/api/clients/route.ts:78-104`.
- **What's wrong** — The flow is `SELECT subscription → SELECT count(clients) → INSERT client`. Two simultaneous POSTs from a free-tier user (limit=1) each see `total=0`, both pass the check, both insert. Now the agency owns 2 clients on a 1-client plan.
- **Why it matters** — Plan-limit bypass costs revenue (and worse: legitimate ones complain when they can't add a 3rd while a script kiddie squats with 50). Already a known concern in your audit spec ("can a free-tier user bypass the client/CSV/seat limits via direct API calls").
- **Suggested fix** — Either (a) move the count + insert into a `BEGIN IMMEDIATE` transaction (libsql supports this via `client.transaction`), (b) add an `agency_client_count` materialized column with a `CHECK` constraint, or (c) post-insert verify: `INSERT … RETURNING; SELECT count(); if count > limit DELETE`. Easiest: wrap in `db.transaction` and re-count inside.

## C-5. Logo & Meta-config endpoints write to the filesystem — silently broken on Vercel.

- **File:line** —
  - `app/api/upload-logo/route.ts:49-69` (`fs.mkdirSync`, `fs.writeFileSync` to `public/...`).
  - `app/api/save-meta-config/route.ts:21-22` (`fs.writeFileSync("config/meta.json", …)`).
- **What's wrong** — Vercel's serverless filesystem is ephemeral and `public/` is built into the bundle at deploy time. `fs.writeFileSync` "succeeds" to `/var/task/...` but is gone on the next invocation, and on read-only filesystems it throws. Same for `config/meta.json`.
- **Why it matters** — User uploads agency logo → gets a green check → reloads → logo gone. Meta credentials saved → gone on next cold start. Customer thinks the product is broken. This is a guaranteed first-touch demo embarrassment.
- **Suggested fix** — Store logos as bytes in DB (`logo_bytes BLOB, logo_mime TEXT` on agencies/clients) and serve via `app/api/logos/[id]/route.ts`, OR push to S3/R2/Vercel Blob. Move `config/meta.json` to a `meta_configs` table keyed by `agencyId`. Until that lands, hide the upload UI behind an env flag and put a "Self-hosted only" banner on `/setup`.

## C-6. No subscription-status enforcement — canceled/past-due users keep all access.

- **File:line** — across all data endpoints; no callers of `schema.subscriptions.status` other than the read-only banner. Grep proof: only files referencing `schema.subscriptions` for writes/reads are billing-related, plus `app/api/clients/route.ts:81` which checks `plan` but not `status`.
- **What's wrong** — `app/api/clients/route.ts:84` reads `subRows[0]?.plan` but never `.status`. `app/api/clients/[slug]/csvs/route.ts` doesn't look at subscriptions at all. `app/audit/[client]/page.tsx` doesn't either. When `invoice.payment_failed` flips status to `past_due` (webhook line 191-200) the user keeps generating audits.
- **Why it matters** — Free 30+ day runway for delinquent customers. Easy revenue leak.
- **Suggested fix** — Add a `assertActiveBilling(agencyId)` helper in `lib/access.ts` that returns true for `plan==="free" && status==="trialing"` or `status==="active"`, false for `past_due` after a 7-day grace, `canceled`/`incomplete` immediately. Call it at the top of `POST /api/clients`, `POST /api/clients/[slug]/csvs`, and `app/audit/[client]/page.tsx` (server). Render `DowngradeWarning` in those failure paths.

## C-7. No CSV-count limit, no seat limit, no audit-count limit — pricing page lies.

- **File:line** — `app/pricing/page.tsx:35-95` advertises "1 audit per month" (free), "1 user seat" (free/pro), "Up to 10 seats" (agency). The only plan check is `PLAN_CLIENT_LIMITS` in `app/api/clients/route.ts:18-22`. Grep: no `audit_count`, no `seats`, no monthly counter in the schema.
- **What's wrong** — Free trial user uploads CSVs unlimited times to one client and runs unlimited audits. Agency user creates 50 sub-users.
- **Why it matters** — You're charging different price points for limits you don't enforce. The free trial is effectively "Pro for one client, forever." Every "Agency" customer is a sucker if Pro gets them most of the value.
- **Suggested fix** —
  - Audits: add `audit_runs` table (`agencyId, clientId, ranAt`) and check `count(thisMonth) < PLAN_AUDIT_LIMITS[plan]` before `runAudit()` in `app/audit/[client]/page.tsx:158`. Or accept that free is "1 client → unlimited runs on that client" and rewrite the pricing page accordingly.
  - Seats: in `app/api/users/route.ts:73` POST, after the admin check, also enforce `count(users by agencyId) < PLAN_SEAT_LIMITS[plan]` when an admin assigns a user to a non-admin agency.
  - Decide which limits you actually want to bill on, then enforce them — or remove them from the pricing page before launch.

## C-8. `/reset-password` is auth-gated by middleware → password-reset email link is broken.

- **File:line** — `middleware.ts:19-26`. `PUBLIC_PATHS = ["/login", "/pricing", "/api/auth", "/api/billing/webhook", "/_next", "/favicon"]`. `/reset-password` is missing.
- **What's wrong** — User clicks reset link from email → middleware sees no `req.auth` → redirects to `/login?from=/reset-password?token=...`. They can never set their new password.
- **Why it matters** — The entire forgot-password flow is dead. Combined with C-1 (no signup), a user who locks themselves out has zero recovery path.
- **Suggested fix** — Add `"/reset-password"` and `"/forgot-password"` to `PUBLIC_PATHS` in `middleware.ts:19`. Same for `/legal/privacy` and `/legal/terms` (sitemap.ts lists them as public-facing; they shouldn't require login). While you're in there, add `/signup` for C-1.

## C-9. Password-reset emails are never actually sent.

- **File:line** — `app/api/auth/forgot-password/route.ts:95-108`.
- **What's wrong** — When `RESEND_API_KEY` is unset (Lester said it isn't configured), the route `console.log`s the reset link to the server and returns success. When the env var *is* set, the code still doesn't send anything — the comment says `// await sendResetEmail(email, resetUrl);` but it's commented out (line 105). The user gets "If an account exists, a reset link has been sent" — and nothing arrives.
- **Why it matters** — Silent failure of a security-critical flow. Users assume the product is broken and never come back. Worse, the reset token is logged to your Vercel function logs which is the wrong place to put a credential.
- **Suggested fix** — Wire `lib/email.ts` (Resend) into line 105. Until it ships, gate the "Forgot password?" button (`app/login/LoginForm.tsx:101`) behind `!!process.env.RESEND_API_KEY` server-rendered into a prop, and show "Contact your admin" if disabled. Remove the `console.log` of the token (line 100-103) — never log credentials, even in dev.

## C-10. Stripe webhook has no event deduplication or ordering — out-of-order events corrupt subscription state.

- **File:line** — `app/api/billing/webhook/route.ts:166-227`. No `event.id` storage; no `event.created` comparison.
- **What's wrong** — Stripe at-least-once delivers events. The handler is not idempotent: `checkout.session.completed` arriving twice writes "active" twice (OK), but `customer.subscription.deleted` then a retried older `customer.subscription.updated(active)` flips you back to active after cancellation. Also `customer.subscription.deleted` (line 213) sets `status: "canceled"` without zeroing out `currentPeriodEnd` — front-end keeps showing "next billing in X days" on a dead subscription.
- **Why it matters** — Customers who canceled keep getting service. Worse: the inverse, where a transient old "past_due" event lands after a successful "active" → user gets locked out for no reason and writes you an angry email.
- **Suggested fix** —
  - Add `stripe_events (id text primary key, type text, received_at integer)`. At the top of the handler after sig verification, `INSERT … ON CONFLICT DO NOTHING; if not inserted, return 200 immediately`.
  - Track `subscriptions.lastEventTs integer` and refuse to apply a patch if `event.created * 1000 < lastEventTs`.
  - In the `customer.subscription.deleted` branch, also set `currentPeriodEnd: null` so the dashboard stops lying.

---

# 🟠 HIGH

## H-1. Stripe webhook rate-limits BEFORE signature verification.

- **File:line** — `app/api/billing/webhook/route.ts:142-148` (rate limit) vs. line 160-168 (signature).
- **What's wrong** — `rateLimit("webhook:" + ip)` is per-IP in an in-memory map. Stripe sends from a published IP pool (`https://stripe.com/files/ips/ips_webhooks.json`) — a burst from one IP during a backfill or a payment flurry could 429 you, and Stripe will mark the endpoint unhealthy after retries.
- **Why it matters** — Webhook delivery failures = stale subscription state = customers locked out for paid features, or freeloaders kept active.
- **Suggested fix** — Either remove the rate-limit on `/api/billing/webhook` entirely (Stripe's HMAC is your authn), or move it *after* `stripe.webhooks.constructEvent(...)` so only signature failures count toward the limit.

## H-2. Audit page passes attacker-controlled `clientSlug` into `path.join(process.cwd(), ...)`.

- **File:line** — `app/audit/[client]/page.tsx:76`, `app/admin/clients/[slug]/page.tsx:111`, `app/page.tsx:53` (scanFsClients), `app/api/upload-logo/route.ts:60-63`.
- **What's wrong** — `clientSlug` comes from the URL. `path.join(cwd, "public/csvs", "../../etc")` resolves to `/etc`. `fs.existsSync` then probes that. `runAudit({ csvDir })` does `fs.readdirSync(csvDir)` (engine/parsers/metaAdsCsv.ts:291) on whatever directory you point it at. `findAsset` (app/audit/[client]/page.tsx:54) does `fs.existsSync` for `<dir>/logo.{svg,png,jpg,webp}` — directory listing-by-probing.
- **Why it matters** — On a slug like `../../node_modules`, you can detect existence of arbitrary files in the deploy bundle. Combined with the lack of a basename sanitizer, it's a directory traversal primitive — limited impact because Next.js dynamic segments don't allow `/` directly, but `%2F` and `..` are not blocked.
- **Suggested fix** — Add `if (!/^[a-z0-9-]+$/.test(clientSlug)) notFound();` at the top of `app/audit/[client]/page.tsx:70`, `app/admin/clients/[slug]/page.tsx` and inside `upload-logo`. Same for `app/page.tsx:53` (filter scan results).

## H-3. Admin can delete their own admin role and lock out the platform.

- **File:line** — `app/api/users/route.ts:128-167` (PATCH). Self-deletion is blocked (line 200) but self-demotion is not.
- **What's wrong** — Admin sets `body.userId = session.user.id, body.role = "agency"` on themselves. If there's only one admin, the platform has no admins. `/admin/users` requires admin role, so there's no way to recover except SQL.
- **Why it matters** — Footgun. The admin panel UI in `app/admin/users/UserList.tsx` won't even warn you. With a single-admin seed (default), one slip locks Lester out of his own product.
- **Suggested fix** — In `PATCH /api/users` around line 154: `if (body.userId === session.user.id && body.role === "agency") return 400 "Cannot demote yourself"`. Also guard against demoting the last remaining admin: `if (currentRole === "admin" && body.role === "agency") { if ((await db.select({c: count()}).from(users).where(eq(role, "admin")))[0].c <= 1) return 400 "Cannot remove last admin"; }`.

## H-4. JWT-only sessions can't be revoked → stale tokens survive user deletion.

- **File:line** — `auth.config.ts:9` (`session: { strategy: "jwt" }`), `auth.ts:60-90` (Credentials provider). No `events.signOut` or `jwt` callback DB lookup.
- **What's wrong** — User is created by admin, signs in, gets a 30-day JWT. Admin then deletes that user via `DELETE /api/users?userId=…` (route line 178-210). The deleted user's JWT is still valid until expiry — they continue accessing the dashboard. Same problem if you change a user's `agencyId`: their JWT keeps the old one until the next sign-in.
- **Why it matters** — Real customer scenario: agency fires an employee → admin deletes their user → employee still pulls competitor CSVs for 30 days from the cached cookie.
- **Suggested fix** — In `auth.config.ts` `callbacks.jwt`, refetch the user row on each token use and `return null` (i.e. invalidate) if the user no longer exists or `token.agencyId !== currentAgencyId`. Yes, it's a per-request DB hit; that's the right call for B2B SaaS. Alternative: short-lived JWT (~1h) + refresh token that DB-checks.

## H-5. `clientSlug` regex in upload-logo allows uppercase, which mismatches DB.

- **File:line** — `app/api/upload-logo/route.ts:60`. `(clientSlug as string).replace(/[^a-z0-9-_]/gi, "-");`
- **What's wrong** — The `i` flag makes the character class case-insensitive, so `AcMe` survives unchanged. But everywhere else in the app, slugs go through `slugify()` which lowercases (`app/api/clients/route.ts:23-29`). Result: logo gets written to `public/csvs/AcMe/logo.png`, but the audit page looks under `public/csvs/acme/`.
- **Why it matters** — Customer uploads logo → "saved!" → it doesn't appear. Subtle data-mismatch bug that's painful to diagnose.
- **Suggested fix** — Drop the `i` flag and lowercase first: `clientSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-")`. Better: validate against `getVisibleClientBySlug(clientSlug)` and use `client.slug` from the DB.

## H-6. `/setup` page is not gated to admin role — non-admin users see it (broken UX).

- **File:line** — `app/setup/page.tsx` (no auth check). API routes `/api/get-meta-config`, `/api/save-meta-config`, `/api/test-meta-connection` all require `role === "admin"`.
- **What's wrong** — An agency-role user can navigate to `/setup`, the page renders the dropzones and the Meta API form, the `useEffect` calls `/api/get-meta-config` which returns 403, the form fails silently, the Save button POSTs and returns 403. The user thinks the app is broken.
- **Why it matters** — Looks like a permissions bug to a paying customer. Bad first impression.
- **Suggested fix** — Convert `app/setup/page.tsx` to a server component shell that calls `requireAdmin()` from `lib/access.ts` and `redirect("/")` if not admin; mount the existing client component as `<SetupForm>` inside. Or at minimum, hide `/setup` links from non-admin nav.

## H-7. Webhook downgrade to "free" on `customer.subscription.deleted` doesn't reset the plan.

- **File:line** — `app/api/billing/webhook/route.ts:213-219`.
- **What's wrong** — Only `status: "canceled"` is set. `plan` stays at `"pro"` or `"agency"`. The billing page (`app/admin/billing/page.tsx:67`) reads `sub?.plan ?? "free"` → still shows them as a Pro customer. The client-limit check in `app/api/clients/route.ts:84` reads `subRows[0]?.plan` and grants Pro-tier limits forever to a canceled subscription.
- **Why it matters** — Customer cancels → keeps "Pro" client cap → never re-subscribes. Free service.
- **Suggested fix** — `app/api/billing/webhook/route.ts:215` should also set `plan: "free"`. And the client-limit check in `app/api/clients/route.ts:84-86` should treat `status !== "active" && status !== "trialing"` as free regardless of `plan`.

## H-8. Pricing mismatch: `/admin/billing` says $49/$199, pricing page says $99/$299.

- **File:line** — `app/admin/billing/page.tsx:24-26` (`pro: $49, agency: $199`) vs. `app/pricing/page.tsx:55,77` ($99/$299) and `.env.example:64-66` ($99/$299).
- **What's wrong** — Hardcoded plan prices in two places drifted. Customer who upgraded sees "$49/mo" on billing page but was charged $99.
- **Why it matters** — Trust killer — looks like sketchy pricing. Customer asks for refund (your TOS says no refunds — even worse first-week story).
- **Suggested fix** — Centralize. Create `lib/plans.ts` exporting `PLANS = { pro: { monthly: 99, annual: 79, ... }, agency: {...} }` and import everywhere. Or pull the actual unit_amount from Stripe (best).

## H-9. Pricing page caches stale "$X/mo" rendering — annualPrice fallback is wrong.

- **File:line** — `app/pricing/PricingCard.tsx:74-75`.
- **What's wrong** — `displayPeriod = billingPeriod === "annual" ? "per month, billed annually" : props.period`. Free tier has `period: "for 14 days"` but isn't subject to annual mode (it short-circuits at line 26). OK. But: when annual is selected and `annualPrice` is undefined (e.g. enterprise card uses different branch — fine), then on Pro/Agency `displayPrice = annualPrice ?? price` — that's the *monthly* price displayed under "per month, billed annually." Subtle but a customer will spot it.
- **Why it matters** — Cents-on-the-dollar UI bug that flags amateur hour.
- **Suggested fix** — Don't toggle the period label unless `annualPrice` is actually defined: `displayPeriod = (billingPeriod === "annual" && props.annualPrice) ? "per month, billed annually" : props.period`.

## H-10. `legal/privacy` and `legal/terms` are auth-gated → no-account visitors can't read TOS before buying.

- **File:line** — `middleware.ts:19-26`. Same root cause as C-8.
- **What's wrong** — `/legal/privacy` is listed in `sitemap.ts` as public, but the middleware redirects to `/login`. Same for `/legal/terms`. Google can crawl them, real prospects can't.
- **Why it matters** — Privacy policy must be reachable from the cookie banner / footer / Stripe checkout's "terms" link. Mandatory for GDPR/CPRA compliance. Also: Stripe's terms-of-service URL field requires a publicly reachable page.
- **Suggested fix** — Add `"/legal"` to `PUBLIC_PATHS` in `middleware.ts:19`.

## H-11. NextAuth `trustHost: true` with no allowlist → potential auth-callback abuse.

- **File:line** — `auth.config.ts:6`.
- **What's wrong** — `trustHost: true` trusts whatever the `Host` header says. With JWT sessions and cookie `SameSite=Lax` (NextAuth default), this is mostly OK, but on Vercel preview deploys the same code answers under `<commit>-<project>.vercel.app` and could be set as the callback target. Combined with the open-redirect-sanitizer in `LoginForm.tsx:14` (only blocks `//…` and non-`/` paths), an attacker can craft a phishing flow on a preview URL.
- **Why it matters** — Account-takeover via callback host spoofing. Low likelihood but high impact.
- **Suggested fix** — Set `AUTH_TRUST_HOST=false` in prod and set `NEXTAUTH_URL=https://blankpageaudits.com`. In `auth.config.ts:6` change to `trustHost: process.env.NODE_ENV !== "production"`.

## H-12. CSV upload accepts anything ending in `.csv` — no content sniff, no UTF-8 validation, no row-cap.

- **File:line** — `app/api/clients/[slug]/csvs/route.ts:62-83`.
- **What's wrong** —
  - Only checks `f.name.toLowerCase().endsWith(".csv")` and `f.size > 10MB`. A renamed PE binary or a 9MB ZIP with the right extension passes. `await f.text()` decodes as UTF-8 — invalid bytes become `�` silently.
  - No row-cap. A 1M-row CSV that's under 10MB (yes, it's possible — short rows) will hang `papaparse` synchronously and timeout the request, possibly OOM the function.
  - No header sniff. The parser elsewhere classifies by header names (`engine/parsers/metaAdsCsv.ts`); a malformed file is stored in DB and breaks every future audit run.
- **Why it matters** — DoS by upload. Garbage data persisted to DB. The CSV `content` column is `text NOT NULL` — Turso row size is bounded; 10MB+ rows on Turso's free tier will throw.
- **Suggested fix** —
  - Sniff the first 4 bytes for the BOM and/or `try { Papa.parse(text.slice(0, 1024)) }`. Reject if no recognized Meta header is present.
  - Cap rows: parse a quick line-count on the buffer first, reject if `> 50_000` lines.
  - Validate `f.type === "text/csv"` in addition to extension (browser-supplied but raises the bar).
  - Wrap `f.text()` in a `try { new TextDecoder("utf-8", { fatal: true }).decode(buf) }` to reject invalid UTF-8.

## H-13. Stripe checkout sets `customer_email` from session but doesn't pre-create or reuse a Stripe Customer → duplicates.

- **File:line** — `app/api/billing/checkout/route.ts:127-149`.
- **What's wrong** — Each checkout creates a *new* Stripe Customer (Stripe's default when only `customer_email` is set). If a user clicks "Get started" twice, you get two customers with the same email. Your subscription row only stores one `stripeCustomerId`. Webhooks for the other Customer match nothing → orphaned Stripe records.
- **Why it matters** — Billing reconciliation hell. Customer support asks "why am I being charged twice" — and you literally have two customers in Stripe.
- **Suggested fix** — Before creating the Checkout session, look up existing `subscriptions.stripeCustomerId` for `agencyId`; if set, pass `customer: stripeCustomerId` instead of `customer_email`. If not, create the customer first via `stripe.customers.create({ email })` and store it.

## H-14. `dbAvailable` stub uses a `Proxy` cast that lies to TypeScript and will crash at runtime.

- **File:line** — `lib/db.ts:39-92`.
- **What's wrong** — When DB is unavailable, every chain awaits to `[]`. Code like `const fresh = await db.select()...where().limit(1); return fresh[0] ?? {ok: true}` (e.g. `app/api/agencies/route.ts:104`) returns `undefined` then returns `{ok: true}` — OK. But `app/api/billing/verify/route.ts:80-95` does `existing[0]` access on `[]` → `undefined.stripeCustomerId` would 500 if any caller relies on the value. Worse: `db.update(...).set(...)` with the Proxy returns the proxy itself; callers calling `.execute()` won't trigger the await thenable correctly in some Drizzle versions.
- **Why it matters** — Deploy-safe mode is a footgun. In legacy mode, the code paths above silently no-op writes. In multi-tenant mode where DB transiently fails, the same code returns `[]` and proceeds as if "no rows" → e.g. plan-limit check sees zero clients and lets you create unlimited.
- **Suggested fix** — Stop returning the stub for write operations. Add `if (!dbAvailable) throw new Error("DB unavailable")` at the head of all `db.insert/update/delete` callers, or use a typed `Result<>` wrapper. At minimum, document in `lib/db.ts` that "stub mode returns empty arrays — DO NOT use to enforce limits."

## H-15. `auth.config.ts` `session` callback uses `as any` and loses types.

- **File:line** — `auth.config.ts:24-31`.
- **What's wrong** — `const su = session.user as any; su.id = token.uid as string; …`. The `User` type declaration in `auth.ts:23-33` adds `role`/`agencyId` as optional — when the JWT lacks them (e.g., a token from before a deploy that didn't set them), `session.user.role` is `undefined` and `requireAdmin` (`lib/access.ts:55`) does `if (user.role !== "admin") redirect("/")` — which incorrectly *redirects* a legitimate admin whose token was minted on an older code version.
- **Why it matters** — Existing admin sessions break on every deploy until they sign out and back in.
- **Suggested fix** — Default the role: `su.role = (token.role as string) ?? "agency"` is already there but `requireAdmin` should also tolerate `undefined` and rehydrate from DB. Better: invalidate stale tokens by bumping `AUTH_SECRET` on schema-of-token changes (which forces re-login).

## H-16. `PUBLIC_PATHS` matcher uses `startsWith(p)` — bypasses auth on prefix-similar routes.

- **File:line** — `middleware.ts:34-39`. `pathname.startsWith(p)` is OR'd with the safer checks.
- **What's wrong** — The third condition `pathname.startsWith(p)` is redundant with the second one (`pathname.startsWith(p + "/")`) but adds prefix-without-slash matching. So `/login-bypass` matches because it starts with `/login`. `/api/authentication-test` matches because it starts with `/api/auth`. Today no such routes exist, but the moment one is added, it's auto-public.
- **Why it matters** — Foot-gun primed for a future regression.
- **Suggested fix** — Remove the third condition. Keep only `pathname === p || pathname.startsWith(p + "/")`.

## H-17. Tier "Coming Soon" features sold as if available in pricing comparison matrix.

- **File:line** — `app/pricing/page.tsx:131-159`. Most features marked "Soon" are also listed without that tag in the feature bullets above (`PLANS[i].features` at lines 39-95).
- **What's wrong** — In the bulleted list, "Scheduled auto-audits" appears next to "Coming Soon", but the comparison matrix shows it as a green check for Enterprise. A customer reads the matrix as the source of truth and pays the Agency tier expecting features that don't exist.
- **Why it matters** — Misrepresentation in pricing → chargebacks → Stripe risk review. Worse if a customer screenshots and tweets it.
- **Suggested fix** — Either ship the features before launch, or remove "Coming Soon" features entirely from the comparison matrix and pricing bullets. Don't sell on vapor.

## H-18. CSV upload deletes existing row, then inserts, with no transaction.

- **File:line** — `app/api/clients/[slug]/csvs/route.ts:84-92`.
- **What's wrong** — `await db.delete(csvFiles).where(...); await db.insert(csvFiles).values(...);` If the second call fails (out of disk, dup constraint, network blip), the customer's previous CSV is gone and the new one didn't land. Loss of data with no UI to indicate it.
- **Why it matters** — Customer re-uploads campaigns.csv to refresh — the old one is wiped, the new one fails, the audit page now says "No data". Easy data-loss bug.
- **Suggested fix** — Use `db.transaction(async (tx) => { await tx.delete(...); await tx.insert(...); })`. libsql supports it. Or change the unique key + use `INSERT ... ON CONFLICT DO UPDATE` (UPSERT).

---

# 🟡 MEDIUM

## M-1. No CSRF protection on state-changing API routes beyond SameSite cookies.

- **File:line** — All `app/api/*` routes.
- **What's wrong** — NextAuth's CSRF token only applies to its own routes. Custom POSTs/PATCH/DELETE rely solely on cookie `SameSite=Lax`. Modern browsers default this, but Safari's enforcement is laxer and there's a 2-minute window after navigation where Lax cookies are sent on top-level POSTs.
- **Why it matters** — A malicious site can trick an admin into clicking a link that triggers `DELETE /api/clients?clientId=...` if they happen to be logged in. Low likelihood but the consequence is catastrophic.
- **Suggested fix** — Use NextAuth's CSRF token (read from `__Host-next-auth.csrf-token` cookie) on every state-changing fetch. Or add an `Origin`/`Referer` check at the top of each mutation route (reject if `req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL`).

## M-2. Rate-limiter is global in-memory → useless on Vercel (cold starts split state).

- **File:line** — `lib/rate-limit.ts:1-90`.
- **What's wrong** — The `store: Map<string, …>` lives in one Lambda invocation's memory. Vercel runs many concurrent instances; each has its own map. The "5 requests per 15 minutes" budget becomes "5 per instance per 15 min" — an attacker rotating across cold starts effectively bypasses it.
- **Why it matters** — `forgot-password` brute force is the realistic attack — enumerate emails, send hundreds of resets. Also no real protection on `/api/auth` sign-in (NextAuth lacks built-in rate limits).
- **Suggested fix** — Upstash Redis or Vercel KV. `@upstash/ratelimit` is one import. Until then, document the limitation and add per-route `runtime = "nodejs"` + a `region: "iad1"` pin so all requests at least hit the same warm instance.

## M-3. `bcrypt` work factor inconsistent across the codebase (10 vs 12).

- **File:line** — `scripts/seed.ts:39` (cost=10) vs `app/api/users/route.ts:103,157` (cost=12) vs `app/api/auth/reset-password/route.ts:78` (cost=12) vs `app/api/change-password/route.ts:62` (cost=12).
- **What's wrong** — The seeded admin gets cost=10 (~100ms); everyone else gets cost=12 (~400ms). Not a security hole today, but the seeded admin's password is weaker against offline attack.
- **Why it matters** — Defense-in-depth fail. Cost=12 is the safer default in 2026.
- **Suggested fix** — `scripts/seed.ts:39` → `bcrypt.hash(password, 12)`. Centralize the constant: `export const BCRYPT_COST = 12` in `lib/auth-config.ts`.

## M-4. `scripts/seed.ts` logs the admin password in plaintext.

- **File:line** — `scripts/seed.ts:91`. `console.log("password: " + ADMIN_PASSWORD)`.
- **What's wrong** — On any production seeding run, the password is permanently in `vercel logs`, in deploy logs, in CI logs, etc.
- **Why it matters** — Logs are forwarded to third-party tools, retained for compliance, etc. A baked-in credential leak.
- **Suggested fix** — Print "Login at /login with the SEED_ADMIN_EMAIL/PASSWORD env vars you set" and stop echoing the password.

## M-5. Audit page does synchronous CSV parsing + heavy analysis on the request thread.

- **File:line** — `app/audit/[client]/page.tsx:158-172`. `runAuditFromFiles` writes every CSV to `/tmp`, parses with `papaparse`, runs ten `analyze*` modules — all synchronous, all blocking.
- **What's wrong** — On a client with five 8MB CSVs, this is a multi-second block of the function. Next.js dynamic-segment SSR cold-starts will time out (Vercel's default is 10s).
- **Why it matters** — Page load > 10s on the audit dashboard for any non-trivial client = total feature failure.
- **Suggested fix** — Cache the `AuditResult` keyed by `(clientId, hashOfFileSet)` in a new `audit_results` table; recompute lazily only when the hash changes. Or move the heavy compute into an `/api/audit/[client]/run` route that returns JSON, and have the dashboard `useSWR` it. While you're there, replace the `os.tmpdir()` round-trip in `engine/parsers/uploadedCsv.ts` with in-memory parsing (Papa.parse accepts strings directly — the tempfile dance is unnecessary).

## M-6. Drizzle migration is missing five columns and one table that exist in `schema.ts`.

- **File:line** — `db/migrations/0000_glorious_ulik.sql` vs `db/schema.ts:13-21,118-128`.
- **What's wrong** — Migration creates `agencies` with `primary_color` but not `secondary_color`, `accent_color`, `highlight_color`, `pop_color`. Also missing the entire `password_resets` table.
- **Why it matters** — Running `drizzle-kit push` on a fresh Turso DB applies the migration → schema is stale → every PATCH to `/api/agency` writing a secondary color fails with "no such column." The forgot-password flow can't insert tokens.
- **Suggested fix** — Run `npm run db:generate` (drizzle-kit) on a clean snapshot, commit the resulting `0001_*.sql`. Or rebuild `0000_*.sql` from current schema and reset. Verify locally with `drizzle-kit push --verbose`.

## M-7. `app/api/test-meta-connection` leaks third-party error message verbatim.

- **File:line** — `app/api/test-meta-connection/route.ts:30-32`.
- **What's wrong** — `data.error?.message` from Facebook's Graph API is forwarded to the client unfiltered. Meta sometimes echoes back the access token in error messages ("Invalid OAuth access token: EAAB...").
- **Why it matters** — Possible token disclosure to anyone with admin access — admin shouldn't need it, but the path of least resistance is to not show it.
- **Suggested fix** — Whitelist a short set of clean messages: `if (!res.ok) return { ok: false, error: "Connection failed — token may be expired or scoped wrong." }`. Log the verbose one server-side via `log.warn`.

## M-8. `next.config.ts` ships no security headers.

- **File:line** — `next.config.ts`.
- **What's wrong** — No CSP, no `X-Frame-Options`, no `Strict-Transport-Security`, no `Referrer-Policy`. Default Next.js doesn't add any.
- **Why it matters** — Open to clickjacking (no XFO/CSP frame-ancestors), to MITM downgrade until first TLS hit (no HSTS preload), referrer leakage to outbound links.
- **Suggested fix** — Add a `headers()` block: `{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }, { key: "Content-Security-Policy", value: "default-src 'self'; ..." }] }`. A starter CSP that fits this codebase: `script-src 'self' 'unsafe-inline' https://plausible.io https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.facebook.com https://api.stripe.com`.

## M-9. No request-size limits on JSON endpoints.

- **File:line** — Every `await req.json()` call. Example: `app/api/users/route.ts:81`.
- **What's wrong** — Next.js App Router has no default body-size cap; a 100MB JSON POST will be parsed in memory.
- **Why it matters** — Memory DoS. Particularly easy on `/api/agency` PATCH which accepts arbitrary string fields.
- **Suggested fix** — Add a shared helper `parseJsonBody<T>(req, maxBytes = 64 * 1024)` that reads `req.body` as a ReadableStream and throws past the cap.

## M-10. No account-lockout / brute-force protection on sign-in.

- **File:line** — `auth.ts:32-67`.
- **What's wrong** — `authorize()` accepts unlimited attempts. The only delay is bcrypt's ~400ms.
- **Why it matters** — Online password guessing is feasible at 2-3 attempts/sec, especially with the in-memory rate limit (M-2) bypassable across instances.
- **Suggested fix** — Add a `failed_signins (email, ts)` ring buffer. After 5 failures in 10 min for an email, lock that email out for 15 min and ignore subsequent attempts. Or use NextAuth's events hook + a Redis counter.

## M-11. Pricing card on home dashboard sometimes shows free-trial CTA to logged-in users.

- **File:line** — `app/page.tsx:227-244`.
- **What's wrong** — Non-admin agency users see a "Pricing" link in the header but no indication of their current plan. If they click and then "Get started", they 401-bounce to `/login` (they're already logged in?) due to PricingCard's hardcoded redirect.
- **Why it matters** — Confused user journey; logged-in users should see "Upgrade" not "Get started", and clicking shouldn't log them out.
- **Suggested fix** — Branch in `PricingCard.tsx:75-87` on whether session exists; if so, skip the `/login` bounce and surface the actual API error.

## M-12. Engine `as any` casts hide type-safety holes in pricing-relevant paths.

- **File:line** — `engine/runAuditFromFiles.ts:42`, `engine/runAudit.ts:78` — `if (activeOnly && 'isActive' in row && !(row as any).isActive)`.
- **What's wrong** — `(row as any).isActive` discards the discriminated-union typing. If a future analysis emits a new `ParsedRow` kind without `isActive`, the check silently no-ops.
- **Why it matters** — Quietly wrong analytics. Customer-trust eroded over time.
- **Suggested fix** — Narrow properly: `if (activeOnly && "isActive" in row && (row as { isActive: boolean }).isActive === false) continue`.

## M-13. Forgot-password is vulnerable to a timing attack to enumerate accounts.

- **File:line** — `app/api/auth/forgot-password/route.ts:60-93`.
- **What's wrong** — When the email exists, the code does a DB write + token hash (~10-20ms). When it doesn't, it returns early (~1ms). Despite the generic 200, the latency reveals existence.
- **Why it matters** — Email enumeration → targeted phishing.
- **Suggested fix** — Always do the bcrypt-equivalent dummy work: `if (!user) await new Promise(r => setTimeout(r, 15))` plus a `randomBytes(32)` call to match the existent path. Or sleep to a target latency.

## M-14. Logo upload accepts `image/svg+xml` — XSS vector.

- **File:line** — `app/api/upload-logo/route.ts:9-13` (`"image/svg+xml": "svg"`).
- **What's wrong** — SVG can contain `<script>`. The uploaded file lives at `/logos/agency.svg` which is served by Next as `image/svg+xml`. Embedded `<script>` would execute in the browser context. The MIME check is browser-trusted (set by the client).
- **Why it matters** — Stored XSS at the user-uploaded SVG URL. Less impactful if the SVG is loaded as `<img src>` (where scripts don't execute), but the audit dashboard uses `<img>` so practical XSS is limited. Still: any admin opening the file directly in a new tab eats the payload.
- **Suggested fix** — Drop `image/svg+xml` from the allowlist. Or strip script tags server-side via `DOMPurify` (Node mode).

## M-15. `engine/parsers/uploadedCsv.ts` swallows parse errors without surfacing them to the user.

- **File:line** — `engine/parsers/uploadedCsv.ts:42-52`.
- **What's wrong** — `try { out.push(parseUploadedCsv(f)); } catch (err) { console.error(...); }` — the user sees nothing about the failure on the audit page.
- **Why it matters** — Customer uploads a corrupted CSV → audit shows partial data with no warning → customer makes business decisions on incomplete data.
- **Suggested fix** — Return parse warnings in `runAuditFromFiles` result and render them in `app/audit/[client]/page.tsx` above the dashboard.

## M-16. UI/A11y: skip-to-content link points at `#main-content` which is missing on the admin layout.

- **File:line** — `app/layout.tsx:43-49` (skip link), `app/admin/layout.tsx:99` (no id), `app/login/page.tsx:27` ✓, `app/pricing/page.tsx:178` ✓.
- **What's wrong** — Skip-to-content lands on nothing inside the admin shell.
- **Why it matters** — A11y failure for keyboard users; WCAG SC 2.4.1 (Bypass Blocks). Easy WCAG audit catch.
- **Suggested fix** — Add `id="main-content"` to the `<main>` in `app/admin/layout.tsx:99` and verify all top-level pages.

## M-17. Several `<button>` and dialog interactions lack focus management.

- **File:line** — `app/login/ForgotPasswordModal.tsx:62-72` has `aria-label="Close"` (good). But `app/admin/users/UserList.tsx` modals don't trap focus, `app/admin/clients/NewClientForm.tsx` "Cancel" button has no aria-label.
- **What's wrong** — Tab traversal escapes the open dialog into the obscured page beneath.
- **Why it matters** — Standard a11y miss. Most users won't notice; screen-reader users will.
- **Suggested fix** — Use a `<dialog>` element (native focus trap) or `@radix-ui/react-dialog`. Add `role="dialog"` `aria-modal="true"` `aria-labelledby` at minimum.

## M-18. `app/audit/[client]/AuditDashboard.tsx` imports the whole audit panel library client-side — bundle weight.

- **File:line** — `app/audit/[client]/AuditDashboard.tsx:1-30`.
- **What's wrong** — 20+ "use client" imports for panels that may not be visible (e.g., `RecommendationCards`, all the visualizers). Only `CanvasMapPanel` is `next/dynamic`.
- **Why it matters** — First-paint slowdown on audit dashboard. Probably > 1MB JS for the route.
- **Suggested fix** — Dynamic-import the visualizers and the less-critical panels: `const InteractiveFunnelExplorer = dynamic(() => import("..."), { ssr: false });`. Defer behind an "Open report" CTA.

## M-19. Error messages can leak internal state via `error.message` pass-through.

- **File:line** — `app/api/billing/checkout/route.ts:136-138`, `app/api/billing/portal/route.ts:72-74`, `app/api/agency/route.ts:91-92`.
- **What's wrong** — `const msg = err instanceof Error ? err.message : "Stripe error"; return NextResponse.json({ error: msg }, …)` — pipes Stripe SDK or Drizzle error messages to the client. These can contain things like "No such customer: cus_X" (resource enumeration), or SQL constraint names.
- **Why it matters** — Information disclosure for an attacker fingerprinting your backend.
- **Suggested fix** — `log.error("internal", err)` server-side; return a generic `"Billing error — try again or contact support"` to the client with an `errorId` for support.

## M-20. Client-side `console.error` leaks stack traces in production.

- **File:line** — `app/admin/error.tsx:14`, `app/audit/[client]/error.tsx:11`, etc.
- **What's wrong** — Internal stack traces (with file paths, function names) end up in the user's browser console. Useful for dev; in prod it's reconnaissance for an attacker.
- **Why it matters** — Low-info disclosure but easy to clean up.
- **Suggested fix** — Gate on `process.env.NODE_ENV !== "production"` or use `log.error` which already does the right thing.

## M-21. `useEffect` in `app/setup/page.tsx:566-574` fires even when user lacks admin role; the 403 response is fetched then ignored.

- **What's wrong** — Wasted request; admin endpoint hit by non-admin.
- **Why it matters** — Annoying noise in logs. Will pollute the per-route rate limits if M-2 is fixed with Upstash.
- **Suggested fix** — Same fix as H-6: gate the page server-side.

## M-22. Timestamps via `unixepoch() * 1000` — millisecond precision OK, but several places mix UTC and local time.

- **File:line** — `app/api/billing/webhook/route.ts:152-156` (`new Date(sec * 1000)`); `db/schema.ts:25` (default `unixepoch() * 1000`); `app/api/auth/reset-password/route.ts:65` (`gt(passwordResets.expiresAt, new Date())`).
- **What's wrong** — Drizzle's `mode: "timestamp_ms"` reads/writes as `Date` — OK. But the audit reporting pulls `Reporting starts` / `Reporting ends` from CSVs in local time and compares to UTC dates.
- **Why it matters** — Subtle bugs at midnight UTC. Customer in Australia exports CSV in AEDT, the engine considers a campaign to span the wrong "today."
- **Suggested fix** — Force UTC throughout; document the convention in `engine/runAudit.ts` header comment.

## M-23. `audit/[client]/page.tsx` reads `client.json` from the FS, trustingly.

- **File:line** — `app/audit/[client]/page.tsx:96-107`.
- **What's wrong** — On a multi-tenant deploy, anyone with disk write can drop a `public/csvs/<slug>/client.json` that overrides display name/industry. Combined with H-2, an attacker could escape `public/csvs`.
- **Why it matters** — Tenant isolation breakdown if filesystem isn't tightly controlled.
- **Suggested fix** — Don't merge FS data when `dbClient` exists (the current code does fallback only — already mostly safe). Verify with a path-prefix check: `assert(realPath.startsWith(path.join(cwd, "public", "csvs")))`.

## M-24. Stripe webhook handler returns 200 even on internal DB error → silent data loss.

- **File:line** — `app/api/billing/webhook/route.ts:171-188` and 224-227.
- **What's wrong** — Per the comment, the design choice was intentional ("we don't want a transient DB blip to cause Stripe to mark the endpoint unhealthy"). But that means a `customer.subscription.deleted` event whose DB write fails is lost forever — Stripe won't retry, your DB never knows the user canceled.
- **Why it matters** — Customer continues to have access after canceling.
- **Suggested fix** — Return 500 on DB error so Stripe retries. Use the event-id dedup table (C-10) to make retries safe. Stripe handles temporary 5xx fine — endpoint is marked unhealthy only after sustained failures.

## M-25. No cookie banner — Privacy page exists but no consent UI.

- **File:line** — `app/legal/privacy/page.tsx`; no banner component found.
- **What's wrong** — Google Analytics (`app/components/Analytics.tsx:33-50`) sets cookies; under GDPR / ePrivacy you need consent before they fire.
- **Why it matters** — EU customers expect to see a banner. Without it, you're legally exposed in the EU. Also Stripe-blocking-prone (Stripe Tax requires accurate jurisdiction).
- **Suggested fix** — Add a minimal cookie banner that gates `<Analytics />` rendering until consent. Or stick to Plausible (cookieless) and remove GA support entirely.

---

# 🟢 LOW

## L-1. Lots of large committed artifacts in repo root.

- **File:line** — `campaign_report.html` (102KB), `interactive_audit.html` (34KB), `public/campaign_report.html` (103KB duplicate), `analyze_creatives.js`, `analyze_raw_csvs.js`, `verify_metrics.mjs`, `verify_metrics.py`, `sna_engine.js`.
- **What's wrong** — These look like scratch/utility files that shouldn't ship with the deploy bundle.
- **Why it matters** — Bigger deploys, slightly bigger Lambda cold starts. Confusing repo for new contributors.
- **Suggested fix** — Move to `scripts/` or delete. Ensure `vercel.json`'s build doesn't pull them.

## L-2. README files have inconsistent versions.

- **File:line** — `README.md`, `README-ENGINE.md`, `README-NEXTJS.md`. Plus 7 markdown reports (`BE-QA-PASS.md`, `BUG-HUNT-REPORT-V2.md`, `CLEANUP-REPORT.md`, `FE-QA-PASS.md`, `FINAL-PASS-REPORT.md`, `TIER-3-CHANGES.md`, `TIER-3-DEPLOY-SAFE-CHANGES.md`, `WIRING-VERIFICATION-REPORT.md`).
- **Why it matters** — Onboarding noise. Most look like artifacts of prior dev passes that aren't current.
- **Suggested fix** — Archive into `docs/legacy/` or delete. Keep a single `README.md`.

## L-3. `tsconfig.json` excludes `scripts/**/*` — `seed.ts` is not type-checked.

- **File:line** — `tsconfig.json:46`.
- **Why it matters** — Refactors that change `schema.ts` won't be caught against `scripts/seed.ts` until runtime.
- **Suggested fix** — Remove the exclude (it's tiny) or add a `tsconfig.scripts.json` that includes it.

## L-4. Drizzle config writes to `data/dev.db` even when running migrations against Turso.

- **File:line** — `drizzle.config.ts:6`.
- **Why it matters** — Confusing for a new dev: they run `npm run db:push` and may not realize they're hitting prod Turso instead of local SQLite if `DATABASE_URL` is exported in their shell.
- **Suggested fix** — Print the resolved URL prominently from `drizzle-kit`, or add a `--confirm-prod` env-var gate.

## L-5. `app/icon.tsx` / `app/opengraph-image.tsx` generate dynamic OG images on every request.

- **What's wrong** — Each request rebuilds the OG SVG/PNG.
- **Why it matters** — Wasted compute; an unchanging brand asset is a perfect candidate for static export.
- **Suggested fix** — `export const revalidate = 86400` to cache for 24h.

## L-6. No test suite anywhere.

- **File:line** — No `*.test.ts` or `*.spec.ts` files in the repo.
- **Why it matters** — Zero regression safety net. Every bug hunt has to re-discover the same issues.
- **Suggested fix** — Add Vitest with: (1) engine unit tests against the `take-charge-roofing` baseline ($3,137.11 / 31 leads), (2) integration tests for `/api/billing/checkout` and `/api/billing/webhook` with mock Stripe, (3) auth-gating tests for every API route.

## L-7. PWA framing without offline support.

- **File:line** — `app/manifest.ts` exists but no service worker.
- **What's wrong** — App Router auto-exposes `/manifest.webmanifest` — installable. But there's no offline fallback.
- **Why it matters** — "PWA" in the changelog is misleading without offline.
- **Suggested fix** — Either ship a real service worker (`next-pwa`) or stop calling it a PWA.

## L-8. Unused / leftover imports in pricing page.

- **File:line** — `app/pricing/page.tsx:1-19`.
- **What's wrong** — `Crown`, `ChevronDown`, etc. — minor.
- **Suggested fix** — `npx ts-prune` once; clean up.

## L-9. Three explicit `as any` in auth code.

- **File:line** — `auth.config.ts:21,26`, `auth.ts` (eslint-disable for the whole shim block).
- **What's wrong** — Refactors break silently because the type model is bypassed.
- **Suggested fix** — Extend NextAuth's module declaration to include `agencyId` and `role` on the JWT (already done in `auth.ts:11-22`, but the `session` callback doesn't use it). Fix the callback to read typed fields.

## L-10. Seeded "Take Charge Roofing" client always re-seeded into prod.

- **File:line** — `scripts/seed.ts:78-82`.
- **What's wrong** — Every prod seeding re-creates Take Charge Roofing. On a real customer-facing prod, this means there's a phantom test client.
- **Suggested fix** — Gate the demo seed behind `SEED_INCLUDE_DEMO=true`. Production should seed only the admin user.

## L-11. Login form lacks "remember me" but shows the same error for "wrong password" vs "no such user".

- **File:line** — `app/login/LoginForm.tsx:42`.
- **What's wrong** — Trade-off — good for enum-resistance, slightly worse for UX of "did I typo my email?".
- **Suggested fix** — None — leave as is.

## L-12. The audit page's "No data" empty state suggests filesystem paths to the user.

- **File:line** — `app/audit/[client]/page.tsx:189-201`.
- **What's wrong** — Tells customers to "Drop your exports in /public/csvs/<slug>/" — meaningless for a hosted SaaS customer.
- **Why it matters** — Confusion. Looks like a forgotten debug message.
- **Suggested fix** — Replace with a CTA: "Upload your first CSV →" linking to `/admin/clients/<slug>`.

## L-13. `engine/runAudit.ts` and `engine/runAuditFromFiles.ts` are ~80% duplicate.

- **What's wrong** — Two parallel codepaths to maintain.
- **Suggested fix** — Have `runAudit` call `runAuditFromFiles` after reading each file off disk. Or unify the loaders.

## L-14. No correlation IDs in logs.

- **What's wrong** — `log.error` writes JSON with no request-id; debugging a customer issue means grepping by user email.
- **Suggested fix** — Add a `requestId` to every log entry, generated from `crypto.randomUUID()` at top of each handler.

---

## What I spot-checked clean

To keep this report from cataloguing non-issues, here's what I checked and found acceptable:

- **SQL injection** — Drizzle uses prepared statements throughout; no `db.execute(rawSql)` or string concatenation found. Clean.
- **Stripe webhook signature verification** — Correctly uses `req.text()` for raw body and `stripe.webhooks.constructEvent`. `runtime = "nodejs"` and `dynamic = "force-dynamic"` set. The mechanism is solid; the *handler logic on top* is the problem (C-10, H-1, M-24).
- **Drizzle relations + cascades** — Sensible. `agencies → clients (cascade)`, `clients → csv_files (cascade)`, `users.agencyId → agencies (set null)`, `subscriptions.agencyId → agencies (cascade)`. The schema is clean even if the migration file is stale (M-6).
- **NextAuth provider isolation** — `auth.config.ts` is edge-safe, `auth.ts` adds the Credentials/Drizzle provider for Node routes. The split is correct.
- **Login open-redirect protection** — `LoginForm.tsx:14` correctly rejects `//evil.com` style protocol-relative redirects.
- **Login generic error** — `app/login/LoginForm.tsx:42-44` returns "Invalid email or password" regardless. Good (anti-enum).
- **Auth gating per API route** — Spot-checked all 14 API routes. All authed-routes call `auth()` and check session, plus admin-only routes check `role`. Agency-scoped routes check `agencyId !== client.agencyId`. The gating itself is consistent — the **scope of who can do what** is occasionally too generous (H-3, C-2) but the auth wiring is solid.
- **Password reset token storage** — SHA-256 hashed in DB, raw token only in email URL. One-hour expiry. Idempotent insert (deletes previous tokens for the user). Good.
- **Bcrypt cost factor in user-facing flows** — 12 is appropriate for 2026. (Inconsistent in seed.ts — see M-3.)
- **CSV upload size guard** — 10MB cap exists (`app/api/clients/[slug]/csvs/route.ts:23`). Could be tighter, but reasonable.
- **TypeScript `strict: true`, `noImplicitAny: true`** — `tsconfig.json:23,27`. Set. (Defeated in places by `as any` — but the discipline is mostly there.)

---

## Quick wins (in priority order, for the fix agent's first PR)

1. **Fix the broken core flows** (C-1, C-8, C-9, H-6) so customers can actually sign up, log in, and reset passwords.
2. **Lock down the agency-scoped logo upload** (C-2, H-5) and switch storage off the filesystem (C-5).
3. **Enforce subscription status + plan limits** (C-6, C-7, H-7) so paying customers aren't subsidizing free riders.
4. **Patch the path traversals** (C-3, H-2).
5. **Fix the Stripe webhook idempotency + ordering** (C-10, H-1, M-24) — billing reconciliation will be the #1 source of customer-support pain after launch.
6. **Migration + price-consistency** (M-6, H-8, H-13).
7. **Security headers + middleware fixes** (M-8, H-16).

---

*Audit by Claude (Sonnet 4.6). Findings cross-checked against the working tree at `d22810f3`. The unpushed files listed at the top of the report were not in scope and need a separate pass — particularly `app/api/fetch-logo/route.ts` which Lester flagged as a likely SSRF.*

---

# Phase 2 findings (cd04aac re-audit)

**Re-audited HEAD:** `cd04aac` ("Add email, notifications, onboarding, logo system, and auto-fetch"). Diff over the original audit at `d22810f` is 20 files / +1,967 lines: seven new files (the unaudited ones from Phase 1) plus twelve modifications.

**Status legend for original findings below:**

- ✅ **ALREADY FIXED** — Lester's changes addressed it (verified in diff).
- 🔄 **STILL OPEN** — Behavior unchanged; original recommendation stands.
- 🆕 **EVOLVED** — The shape of the issue changed; suggested fix updated.

## Status of every original finding

### 🔴 Critical
- **C-1 (no signup endpoint)** — 🔄 STILL OPEN. No `/signup` or `/api/auth/signup` in this push. Pricing page CTAs still terminate at `/login` with no path to create an account.
- **C-2 (logo overwrite cross-tenant)** — 🔄 STILL OPEN, and now also reproduced in `/api/fetch-logo` (see NEW-C-11). The original `/api/upload-logo` is untouched.
- **C-3 (CSV-filename path traversal)** — 🆕 EVOLVED. The original multipart branch still passes `f.name` straight through. cd04aac added a JSON branch (`app/api/clients/[slug]/csvs/route.ts:60-79`) that takes `filename` directly out of `body.filename` with **no validation at all** — even the `.csv` extension check is the only guard. Same `path.basename` fix applies, now in two places.
- **C-4 (plan-limit race)** — 🔄 STILL OPEN. The PATCH path now also accepts `logoUrl`/`websiteUrl` but the POST race is unchanged.
- **C-5 (FS writes broken on Vercel)** — 🔄 STILL OPEN. Both `/api/upload-logo` and the new `/api/fetch-logo` still `fs.writeFileSync` into `public/csvs/...`.
- **C-6 (no subscription-status enforcement)** — 🔄 STILL OPEN. No `getBillingState`-style helper introduced.
- **C-7 (no CSV/audit/seat caps)** — 🔄 STILL OPEN. The new JSON-body upload branch actually bypasses *more* checks than the multipart one (no per-file size guard before insert, only a `content.length` check on the whole body).
- **C-8 (`/reset-password` auth-gated)** — 🔄 STILL OPEN. `middleware.ts` PUBLIC_PATHS unchanged.
- **C-9 (no password-reset emails)** — ✅ ALREADY FIXED in `app/api/auth/forgot-password/route.ts:95-99` — now calls `sendEmail(...)` via `lib/email.ts`. Caveat: the dev-mode fallback in `lib/email.ts:49-54` logs `payload.text?.slice(0, 200)` which **still leaks the reset URL** into server logs (it's embedded in the plain-text body). Low-impact in prod once `RESEND_API_KEY` is set, but worth tightening — see NEW-M-27.
- **C-10 (Stripe webhook no dedup/ordering)** — 🔄 STILL OPEN. Webhook handler unchanged except for now firing notifications on `invoice.paid` / `invoice.payment_failed` — still no event-id dedup, no `event.created` ordering, no `currentPeriodEnd: null` on cancel.

### 🟠 High
- **H-1** rate-limit before sig: 🔄 STILL OPEN.
- **H-2** slug path traversal: 🔄 STILL OPEN.
- **H-3** admin self-demote: 🔄 STILL OPEN.
- **H-4** JWT revocation: 🔄 STILL OPEN.
- **H-5** logo slug regex `/gi`: 🔄 STILL OPEN, and reproduced verbatim in `/api/fetch-logo:179`.
- **H-6** `/setup` not admin-gated: 🔄 STILL OPEN.
- **H-7** webhook keeps `plan` on cancel: 🔄 STILL OPEN.
- **H-8** pricing $49/$199 vs $99/$299: 🔄 STILL OPEN.
- **H-9** annualPrice fallback label: 🔄 STILL OPEN.
- **H-10** legal pages auth-gated: 🔄 STILL OPEN.
- **H-11** trustHost: 🔄 STILL OPEN.
- **H-12** CSV no sniff/UTF-8/rowcap: 🔄 STILL OPEN. Now the JSON branch has zero validation beyond `endsWith(".csv")` and a single byte cap on the full body.
- **H-13** Stripe duplicate customers: 🔄 STILL OPEN.
- **H-14** db stub lies: 🔄 STILL OPEN.
- **H-15** session callback `as any`: 🔄 STILL OPEN.
- **H-16** PUBLIC_PATHS `startsWith(p)` bypass: 🔄 STILL OPEN.
- **H-17** "Coming Soon" sold as available: 🔄 STILL OPEN.
- **H-18** CSV upsert no transaction: 🔄 STILL OPEN; same issue in the JSON branch.

### 🟡 Medium / 🟢 Low
All originally listed mediums/lows remain **🔄 STILL OPEN** except:
- **M-6** schema/migration drift — 🆕 EVOLVED and **worsened**: in addition to the original 5 missing color columns and `password_resets`, cd04aac adds a `notifications` table + `clients.logo_url_light` + `clients.website_url` to `db/schema.ts` *without* a corresponding migration file. Fresh deploys with `drizzle-kit push` will work; existing deploys upgrading with raw SQL will be missing all of it.

---

## New findings on cd04aac

### 🔴 Critical

#### NEW-C-11. `/api/fetch-logo` is a textbook SSRF: no URL validation, follows redirects, fetches user-controlled targets.

- **File:line** — `app/api/fetch-logo/route.ts:113-160`.
- **What's wrong** — Accepts any `url` in the POST body, normalizes to `https://` if it lacks a scheme, then `fetch(targetUrl, { redirect: "follow", ... })`. There's no allowlist, no host check, and no IP-range guard. All of these resolve and get fetched:
  - `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (AWS instance metadata — long-lived AWS credentials)
  - `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token` (GCP)
  - `http://10.0.0.1/admin`, `http://192.168.1.1`, `http://127.0.0.1:6379` (RFC1918 + loopback)
  - `http://[::1]:5432`, `http://localhost` (IPv6 loopback)
  - Even with redirect-blocking, the *extracted* logo URL (`logoUrl` from HTML, line 162) is fetched a second time **also with `redirect: "follow"`** — attacker hosts a public site whose `<meta property="og:image" content="http://169.254.169.254/...">` redirects all logo downloads to the same place.
- **Why it matters** — Cloud credentials exfiltration is the worst case. On Vercel the function may not have IAM creds, but on any self-hosted deploy this is RCE-adjacent (steal AWS creds → assume role → write to S3 / change Lambda → execute code). Even without metadata services, any logged-in attacker can port-scan the Vercel function's egress network (response bodies are returned via the `error` path messages in the 400/500 branches — see NEW-M-19a).
- **Suggested fix** —
  1. Validate the URL before fetch: parse with `new URL()`, require `protocol === "https:"` (no http, no file, no gopher, no data).
  2. Resolve the hostname via `dns.lookup` and reject any address in: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`. Use a small helper `isPrivateAddress(ip)` or the `is-ip-private` package.
  3. Set `redirect: "manual"` and re-run the host check on each `Location:` header.
  4. Re-validate the extracted `logoUrl` with the same checks before the second fetch.
  5. Drop `image/svg+xml` from accepted types (SVG is XSS — see M-14).
  6. Add the standard agency-scoping check from C-2 (call `getVisibleClientBySlug(clientSlug)` and 403 if null; ignore the user-supplied `clientId` entirely, use `client.id`).

#### NEW-C-12. `/api/fetch-logo` has no agency scoping — any logged-in user can overwrite any client's logo + websiteUrl in DB.

- **File:line** — `app/api/fetch-logo/route.ts:175-205`.
- **What's wrong** — `auth()` is called but only checks `session?.user` exists. `clientSlug` and `clientId` are read from the request body and used directly (`safeSlug` for the FS path, `clientId` for the DB UPDATE) without verifying the caller's `session.user.agencyId` owns them. Same defect as C-2 in `/api/upload-logo`.
- **Why it matters** — Cross-tenant attack: agency A's user calls `/api/fetch-logo` with agency B's `clientSlug` + `clientId`, overwriting B's `logoUrl`, `logoUrlLight`, and `websiteUrl` columns to attacker-chosen values. Combined with `ClientLogo.tsx` rendering `<img src={logoUrl}>`, this is a stored-content takeover.
- **Suggested fix** — At the top of the handler after auth: `const client = await getVisibleClientBySlug(clientSlug); if (!client) return 404; const clientId = client.id;` (ignore the user-supplied `clientId`).

#### NEW-C-13. `/api/fetch-logo` writes attacker-controlled bytes to `public/csvs/<safeSlug>/logo.*`.

- **File:line** — `app/api/fetch-logo/route.ts:179-194`.
- **What's wrong** — The downloaded buffer is whatever the remote host (which the attacker controls) returned. Combined with `getExtension` reading the response's `content-type` header (lines 96-107), attacker can serve a `.svg` file (XSS payload), or a `.png` that's actually a polyglot. Plus the same `[^a-z0-9-_]/gi` regex (the H-5 bug) is reproduced.
- **Why it matters** — Stored XSS / content injection that survives across all clients viewing the page (the logo is rendered via `<img>` so JS in SVG doesn't auto-execute, but opening the file directly does). Plus, `safeSlug` keeping uppercase means attacker writes to a different directory than the audit page reads from — same H-5 silent-failure.
- **Suggested fix** — Same migration to DB-backed logo storage as C-5; drop SVG from the type allowlist; lowercase the slug + use the strict regex; cap the buffer size *before* download (use the `Content-Length` header).

### 🟠 High

#### NEW-H-19. `/api/clients` PATCH (`app/api/clients/route.ts:159-170`) accepts unvalidated `logoUrl`/`logoUrlLight`/`websiteUrl` from clients.

- **What's wrong** — The fields are trimmed and stored verbatim. `ClientLogo.tsx:46` renders them as `<img src={activeLogo}>` and the admin UI's logo-upload preview does the same. A `data:image/svg+xml;base64,<payload>` URL is accepted, persisted, and could trigger XSS where the SVG is rendered directly (e.g., open-in-new-tab on the admin page). For `websiteUrl`, no scheme or host validation either — `javascript:alert(1)` is accepted and could fire if any UI ever renders it as a clickable link.
- **Why it matters** — Stored XSS / phishing surface. Combined with the open agency-scope on PATCH (existing check is `client.agencyId === session.user.agencyId` — OK for cross-tenant), the user can attack their *own* admins (e.g., agency-tier user injects a payload that fires when admin opens the client page).
- **Suggested fix** — Validate URLs: require `https:` protocol, host must contain a `.`, length ≤ 2048. For `logoUrl*`, additionally require the path to start with `/csvs/` or `/api/logos/` (an internal URL) — reject any external host outright once C-5's DB-backed storage lands.

#### NEW-H-20. CSV upload's new JSON branch has weaker validation than multipart and is the OnboardingWizard's actual path.

- **File:line** — `app/api/clients/[slug]/csvs/route.ts:60-79`. `OnboardingWizard.tsx:103-120` calls it.
- **What's wrong** — The JSON branch:
  - Reads `filename` from body verbatim → C-3 path-traversal applies, with no `.replace(/[^a-z0-9...]/...)` fallback.
  - Only checks `endsWith(".csv")` (no UTF-8 sniff, no header check, no row cap).
  - Caps on `content.length > MAX_BYTES` *after* `req.json()` already parsed it into memory — a 100 MB JSON body OOMs the function before the cap fires (M-9 territory).
  - Returns `results.push({ filename, ... })` echoing user-supplied filename — fine, but in combination with the notify call (`message: ${client.name} uploaded`) any name containing `<script>` would be persisted into the notifications table and rendered.
- **Why it matters** — Multiple stacked weaknesses on the route that new-user onboarding actually exercises.
- **Suggested fix** — Stream/size-cap the body *before* `.json()`. Run `filename` through `path.basename` + the slug regex. Add the same UTF-8 / row-cap / header-sniff guards proposed in H-12.

#### NEW-H-21. `/api/notifications` GET/PATCH have no rate-limit and no body-size cap.

- **File:line** — `app/api/notifications/route.ts:18-110`.
- **What's wrong** — Polled by `NotificationBell.tsx:62` every 30s for every logged-in user (M-26). PATCH loops over `ids[]` with one UPDATE per id (line 90-99) — a 100k-element ids array does 100k UPDATEs serially while the request hangs. No rate-limit on the route.
- **Why it matters** — DoS pattern. A single malicious user can saturate the DB with `PATCH /api/notifications {ids: [...big array]}` and the route will run for minutes.
- **Suggested fix** — Add `rateLimit("notif:" + ip)` at top of both handlers. In PATCH, cap `ids.length <= 100` and use a single `UPDATE notifications SET read=1 WHERE userId=? AND id IN (?,?,?…)` with a parameterized IN-list.

### 🟡 Medium

#### NEW-M-26. NotificationBell polls every 30s with no backoff or visibility-aware throttle.

- **File:line** — `app/components/NotificationBell.tsx:60-66`.
- **What's wrong** — `setInterval(fetchNotifications, 30_000)` runs while the tab is hidden too. For 1000 active users that's 2000 req/min flat baseline against the API.
- **Why it matters** — Vercel function invocations cost money; Turso has request quotas; this is wasteful.
- **Suggested fix** — Skip polling when `document.visibilityState === "hidden"`, and switch to backoff on errors. Long-term: Server-Sent Events.

#### NEW-M-27. Dev-mode `lib/email.ts` logs the email's text preview — which includes the reset URL.

- **File:line** — `lib/email.ts:49-54`.
- **What's wrong** — `log.info("Email (dev mode ...)", { ..., preview: payload.text?.slice(0, 200) ?? "(html only)" })`. The password-reset template puts the reset URL in the plain-text body, so the URL is in the first 200 characters → goes to the structured-log sink.
- **Why it matters** — Tokens shouldn't be in logs even in dev. Vercel preview deploys often forward logs to third-party sinks.
- **Suggested fix** — Don't log `preview` at all; or strip URLs from the preview; or hardcode `preview: "(omitted)"`.

#### NEW-M-28. `/api/notifications` PATCH has no array-size cap and uses N queries instead of one.

- See NEW-H-21. Covered there.

#### NEW-M-29. OnboardingWizard sends the user-supplied client name as the CSV `filename` body field for the JSON branch.

- **File:line** — `app/components/OnboardingWizard.tsx:103-120` (the call site) + `app/api/clients/[slug]/csvs/route.ts:60-79`.
- **What's wrong** — Whatever the user pastes can become the row's `filename` in the DB, including path-traversal sequences. Filename uniqueness is also per-client, so it conflicts with the parser's `classify()` logic.
- **Suggested fix** — Have the OnboardingWizard either upload via multipart (use the real `File.name`) or pin the filename to a known set (`campaigns.csv`, `ads.csv`, …). Also validate server-side per H-20.

#### NEW-M-30. Notifications table has no expiry and no read-then-archive pattern.

- **File:line** — `db/schema.ts:120-140`, `app/api/notifications/route.ts` (no cleanup).
- **What's wrong** — Old notifications accumulate forever, indexed by `(userId, read)` which inflates with read=1 rows. A heavy user (audit-complete on every CSV upload) will have thousands within a month.
- **Why it matters** — Slower queries over time; Turso row counts grow unbounded.
- **Suggested fix** — On the GET handler, also run `DELETE FROM notifications WHERE userId=? AND read=1 AND createdAt < ?` (older than 30 days). Or a cron-style cleanup route.

### 🟢 Low

#### NEW-L-15. Committed test logos `public/csvs/https-www-gutter-general-com/logo*.png` (165 KB × 2).

- **What's wrong** — Looks like test output from `/api/fetch-logo` (slug `https-www-gutter-general-com` is suspiciously a URL converted to slug). Shouldn't be checked in.
- **Suggested fix** — `git rm public/csvs/https-www-gutter-general-com/*.png`; add to `.gitignore`.

#### NEW-L-16. `notifications` table schema uses `integer` 0/1 instead of native SQLite boolean. Drizzle has a `boolean` mode.

- **What's wrong** — Inconsistent with the rest of the schema (no booleans elsewhere either, so consistent within the repo — leave it).
- **Suggested fix** — Skip; cosmetic.

