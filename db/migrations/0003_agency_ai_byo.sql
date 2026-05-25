-- BYO Anthropic key for Agency tier customers.
--
-- Apply with: npx drizzle-kit push

CREATE TABLE IF NOT EXISTS `agency_ai_configs` (
	`agency_id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`key_mask` text NOT NULL,
	`validated` integer DEFAULT 0 NOT NULL,
	`last_validated_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE cascade
);
