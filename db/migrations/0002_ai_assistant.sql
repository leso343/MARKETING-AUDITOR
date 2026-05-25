-- AI assistant — conversations + messages.
--
-- Apply with one of:
--   DATABASE_URL=libsql://... npx drizzle-kit push
--   turso db shell <your-db> < db/migrations/0002_ai_assistant.sql

CREATE TABLE IF NOT EXISTS `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_conversations_user_idx` ON `ai_conversations` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_conversations_user_client_idx` ON `ai_conversations` (`user_id`, `client_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_tokens` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_messages_created_idx` ON `ai_messages` (`created_at`);
