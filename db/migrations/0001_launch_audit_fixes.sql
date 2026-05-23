-- Launch audit fixes — adds tables/columns to back the launch-audit fixes.
-- Generated from db/schema.ts. Apply with one of:
--
--   DATABASE_URL=libsql://... npx drizzle-kit push
--   turso db shell <your-db> < db/migrations/0001_launch_audit_fixes.sql
--
-- See MIGRATION-NEEDED.md for full notes.

-- M-6 fix: missing color columns on agencies (already in schema.ts but
--          never made it into 0000_glorious_ulik.sql).
ALTER TABLE `agencies` ADD COLUMN `secondary_color` text;
--> statement-breakpoint
ALTER TABLE `agencies` ADD COLUMN `accent_color` text;
--> statement-breakpoint
ALTER TABLE `agencies` ADD COLUMN `highlight_color` text;
--> statement-breakpoint
ALTER TABLE `agencies` ADD COLUMN `pop_color` text;
--> statement-breakpoint

-- cd04aac added these to schema.ts without a migration.
ALTER TABLE `clients` ADD COLUMN `logo_url_light` text;
--> statement-breakpoint
ALTER TABLE `clients` ADD COLUMN `website_url` text;
--> statement-breakpoint

-- M-6 fix: password_resets table (declared in schema.ts but never migrated).
CREATE TABLE IF NOT EXISTS `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_resets_user_idx` ON `password_resets` (`user_id`);
--> statement-breakpoint

-- cd04aac added notifications table to schema.ts without a migration.
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL DEFAULT 'system',
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`read` integer NOT NULL DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_user_idx` ON `notifications` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_unread_idx` ON `notifications` (`user_id`, `read`);
--> statement-breakpoint

-- H-4 fix: tokenVersion for JWT revocation.
ALTER TABLE `users` ADD COLUMN `token_version` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- C-10 fix: stripe_events for webhook idempotency.
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`event_created` integer NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint

-- C-10 / C-7 fix: lastEventTs + trialStartedAt on subscriptions.
ALTER TABLE `subscriptions` ADD COLUMN `last_event_ts` integer;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `trial_started_at` integer;
--> statement-breakpoint

-- C-7 fix: audit_runs for monthly audit-cap enforcement.
CREATE TABLE `audit_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`client_id` text NOT NULL,
	`ran_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_runs_agency_idx` ON `audit_runs` (`agency_id`);
--> statement-breakpoint
CREATE INDEX `audit_runs_ran_at_idx` ON `audit_runs` (`ran_at`);
--> statement-breakpoint

-- C-5 fix: DB-backed logo storage (replaces fs writes to public/).
CREATE TABLE `agency_logos` (
	`agency_id` text PRIMARY KEY NOT NULL,
	`data` blob NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `client_logos` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`variant` text NOT NULL DEFAULT 'dark',
	`data` blob NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_logos_per_client_variant` ON `client_logos` (`client_id`, `variant`);
--> statement-breakpoint

-- C-5 fix: Meta API credentials in DB (replaces config/meta.json).
CREATE TABLE `meta_configs` (
	`agency_id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`app_secret` text NOT NULL,
	`access_token` text NOT NULL,
	`ad_account_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
