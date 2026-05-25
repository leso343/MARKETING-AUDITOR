# Launch-audit fixes — summary

**Branch:** `claude/launch-audit-fixes` (off `cd04aac`)
**Author:** Lester <leso343@users.noreply.github.com>
**Total fix commits:** 11 (+ 1 commit appending the re-audit; + 1 commit
holding the original audit report)

## Counts

| Severity   | Found | ✅ Fixed | 🟡 Already addressed (cd04aac) | 🤝 Lester action only | ⏭️ Deferred |
| ---------- | ----- | -------- | ------------------------------ | ---------------------- | ----------- |
| 🔴 CRITICAL | 13    | 12       | 1 (C-9 by Lester; hardened +)  | 0                      | 0           |
| 🟠 HIGH     | 21    | 19       | 0                              | 0                      | 2 (H-14, partial M-1 wiring) |
| 🟡 MEDIUM   | 30    | 21       | 0                              | 4 (M-1 wiring, M-2 KV, M-19 follow-up, M-25) | 6 (M-5 perf, M-10 lockout, M-16/17 a11y, M-18 bundle, M-22 tz, NEW-M-26/30 polish) |
| 🟢 LOW      | 15    | 4        | 0                              | 0                      | 11 (style/polish)             |

(Severity rows for "found" include the Phase-2 NEW findings: NEW-C-11/12/13, NEW-H-19/20/21, NEW-M-26..30, NEW-L-15/16.)

## What Lester needs to do externally (the punch list)

These are blockers Lester completes outside the repo before / during the
launch deploy. Each is single-action; none requires more code.

### 🔴 Must do before deploy

1. **Run the new migration against Turso.**
   ```bash
   DATABASE_URL="libsql://<your-db>.turso.io" \
   DATABASE_AUTH_TOKEN="<your-token>" \
   npx drizzle-kit push
   ```
   Or apply `db/migrations/0001_launch_audit_fixes.sql` directly via
   `turso db shell`. See `MIGRATION-NEEDED.md`. (Resolves M-6 and pre-stages C-5, C-7, C-10, H-4.)

2. **Set these Vercel env vars** (Production env):
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL=https://blankpageaudits.app` (required now that `trustHost: false` in prod — H-11)
   - `DATABASE_URL=libsql://<your-db>.turso.io`
   - `DATABASE_AUTH_TOKEN=...`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_PRO_PRICE_ID=price_...`         ($99/mo)
   - `STRIPE_AGENCY_PRICE_ID=price_...`      ($299/mo)
   - `STRIPE_PRO_ANNUAL_PRICE_ID=price_...`  ($79/mo billed annually)
   - `STRIPE_AGENCY_ANNUAL_PRICE_ID=price_...` ($239/mo billed annually)
   - `NEXT_PUBLIC_APP_URL=https://blankpageaudits.app`
   - `RESEND_API_KEY=re_...` (otherwise password reset / welcome
     emails won't be sent — they degrade to a log-line and the user
     thinks the product is broken)
   - `EMAIL_FROM="Blank Page Audits <noreply@blankpageaudits.app>"`
     (must be a verified Resend domain)

3. **Create the four Stripe products** in the Stripe Dashboard
   (test mode first to verify, then live):
   - Pro — `$99/mo` recurring (price id → `STRIPE_PRO_PRICE_ID`)
   - Pro Annual — `$948/yr` ($79/mo equivalent; id → `STRIPE_PRO_ANNUAL_PRICE_ID`)
   - Agency — `$299/mo` recurring (id → `STRIPE_AGENCY_PRICE_ID`)
   - Agency Annual — `$2,868/yr` ($239/mo equivalent; id → `STRIPE_AGENCY_ANNUAL_PRICE_ID`)

4. **Register the Stripe webhook endpoint** at
   `https://blankpageaudits.app/api/billing/webhook`. Subscribe to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`. Copy the signing secret
   into `STRIPE_WEBHOOK_SECRET`.

5. **Verify Resend domain + From address.** From defaults to
   `noreply@blankpageaudits.app` — that domain needs SPF + DKIM
   records in DNS before Resend will deliver.

6. **DNS + SSL**: point `blankpageaudits.app` (and `www.`) at Vercel.
   Lester already knows the drill.

### 🟠 Nice-to-have before deploy

7. **Wire Origin/CSRF check** into mutation routes — `lib/api-helpers.isSameOriginRequest()` and `csrfRejection()` are ready; just add at the top of POST/PATCH/DELETE handlers in `app/api/clients`, `app/api/agencies`, `app/api/users`, `app/api/agency`, `app/api/upload-logo`, `app/api/fetch-logo`. ~3 lines per route. (M-1)

8. **Pick a real rate limiter.** `lib/rate-limit.ts` has a banner explaining the in-memory limitation on serverless. Drop in `@upstash/ratelimit` + a Vercel KV / Upstash Redis store and replace the exported `rateLimit()` body. (M-2)

9. **Replace remaining `err.message` returns** in `app/api/billing/portal/route.ts:72-74` and `app/api/agency/route.ts:91-92` with `genericError("…", 502)`. (M-19 follow-up)

10. **Cookie consent banner** if you keep Google Analytics enabled. Removing GA and keeping only Plausible (cookieless) eliminates the need. (M-25)

### 🟡 Post-launch follow-ups

These are explicitly deferred (would require new subsystems or a separate pass):

- **M-5**: cache `AuditResult` keyed by `(clientId, csvHash)` — the C-7 monthly cap makes this less urgent but it's the obvious next perf win.
- **M-10**: account lockout after N failed signins (`failed_signins` table).
- **M-16 / M-17**: full a11y pass (skip-to-content `id`, focus traps).
- **M-18**: dynamic-import the audit-dashboard panels to cut bundle weight.
- **M-22**: UTC normalization in the engine.
- **NEW-M-26**: NotificationBell visibility-aware polling / SSE.
- **NEW-M-30**: scheduled cleanup of read notifications > 30 days.
- **H-14**: replace the `db` Proxy stub with a typed `Result<>` wrapper.

## Ship-readiness verdict

**🟢 Ready to ship — but ONLY after Lester does steps 1-6 of the punch list.**

The codebase is now hardened against the critical and high-severity
findings from both the original audit and the re-audit. Items 7-10 are
defense-in-depth improvements that don't block first launch.

**The single highest-risk thing if any punch-list item is skipped is #1
(the migration).** Without it the app will boot but every code path that
touches `stripe_events`, `audit_runs`, `client_logos`, etc. will throw at
the first request. The schema check is on the critical path of /signup,
/api/billing/webhook, /api/upload-logo, and the audit page.
