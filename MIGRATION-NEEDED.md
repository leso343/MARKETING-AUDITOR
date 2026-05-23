# Database migration required before deploying the launch-audit fixes

These fixes add new tables, columns, and indexes. Run **one** of the
following against your Turso database before / as part of the launch
deploy. The migration is at `db/migrations/0001_launch_audit_fixes.sql`.

## Recommended: `drizzle-kit push`

```bash
DATABASE_URL="libsql://<your-db>.turso.io" \
DATABASE_AUTH_TOKEN="<your-token>" \
npx drizzle-kit push
```

Drizzle will diff `db/schema.ts` against the live DB and apply all the
deltas in `0001_launch_audit_fixes.sql`.

## Alternative: raw SQL

```bash
turso db shell <your-db> < db/migrations/0001_launch_audit_fixes.sql
```

## What it adds

| Table / column                                  | Why                                                          |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `agencies.secondary/accent/highlight/pop_color` | Schema drift fix (M-6)                                       |
| `clients.logo_url_light`, `clients.website_url` | Schema drift from cd04aac (no migration shipped)             |
| `password_resets` table                         | Schema drift fix (M-6)                                       |
| `notifications` table                           | Schema drift from cd04aac (no migration shipped)             |
| `users.token_version`                           | JWT revocation on user delete / role change (H-4)            |
| `subscriptions.last_event_ts`                   | Stripe webhook ordering guard (C-10)                         |
| `subscriptions.trial_started_at`                | 14-day free-trial computation (C-7)                          |
| `stripe_events`                                 | Webhook event dedup (C-10)                                   |
| `audit_runs`                                    | Monthly audit-cap enforcement (C-7)                          |
| `agency_logos`, `client_logos`                  | DB-backed logos — Vercel FS is ephemeral (C-5, NEW-C-13)     |
| `meta_configs`                                  | DB-backed Meta API creds — replaces `config/meta.json` (C-5) |

## Backfill notes

- **Existing `subscriptions` rows** will have `trial_started_at = NULL`. The
  billing helper treats `NULL` as "started at `created_at`" so no
  backfill SQL is required.
- **Existing agencies / clients with a `logo_url`** continue to render
  from that URL (DB-backed storage is additive; the old columns are
  honored as a fallback). Re-uploading via the fixed `/api/upload-logo`
  populates the new tables.
- **`config/meta.json`** if present is *not* migrated automatically. Open
  `/setup` after deploy and re-paste the credentials; they'll land in
  `meta_configs` keyed to your agency.
