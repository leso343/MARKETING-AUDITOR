/**
 * Tier 3 — multi-tenant schema (Drizzle + libsql SQLite).
 *
 * Dev:  file:./data/dev.db
 * Prod: libsql://<db>.turso.io  (Turso is a hosted SQLite — drop-in replacement)
 *
 * Roles & ownership:
 *   - User has role `admin` (sees all clients) or `agency` (sees only their agency's clients).
 *   - Agency owns Clients. Client owns CsvFiles (the uploaded Meta exports).
 *   - Subscription is per-Agency (Tier 4 — wired to Stripe).
 */
import { sqliteTable, text, integer, blob, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const agencies = sqliteTable("agencies", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#ff0000"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  highlightColor: text("highlight_color"),
  popColor: text("pop_color"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    passwordHash: text("password_hash"),
    /** "admin" or "agency" */
    role: text("role").notNull().default("agency"),
    agencyId: text("agency_id").references(() => agencies.id, { onDelete: "set null" }),
    /**
     * H-4 fix: bumped whenever the user must be force-signed-out
     * (account deleted, agency reassigned, role changed). JWTs encode
     * this value at issue time; the `jwt` callback rejects tokens with
     * a stale tokenVersion.
     */
    tokenVersion: integer("token_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    agencyIdx: index("users_agency_idx").on(t.agencyId),
  }),
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    industry: text("industry").default("roofing"),
    logoUrl: text("logo_url"),
    /** Light-mode logo variant — used when html.light is active */
    logoUrlLight: text("logo_url_light"),
    /** Client's website URL — used for auto-fetching logos */
    websiteUrl: text("website_url"),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    agencyIdx: index("clients_agency_idx").on(t.agencyId),
  }),
);

/**
 * CsvFile stores raw Meta export CSV content in the DB. The engine consumes
 * these via `engine/runAuditFromFiles.ts` — the existing on-disk path
 * (engine/runAudit.ts → parseCsvDir) is left untouched so the take-charge-roofing
 * baseline keeps reconciling to $3,137.11 / 31 leads even without uploads.
 */
export const csvFiles = sqliteTable(
  "csv_files",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    /** Raw CSV text */
    content: text("content").notNull(),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    clientIdx: index("csv_files_client_idx").on(t.clientId),
    perClientFilename: uniqueIndex("csv_files_per_client_filename").on(t.clientId, t.filename),
  }),
);

/**
 * Tier 4 — Stripe-backed subscriptions, per-Agency.
 *
 *   plan   : "free" | "pro" | "agency"
 *   status : "trialing" | "active" | "past_due" | "canceled" | "incomplete"
 *
 * Stripe IDs populate on checkout (via /api/billing/verify) and stay in
 * sync via /api/billing/webhook.
 */
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  agencyId: text("agency_id")
    .notNull()
    .unique()
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** "free" | "pro" | "agency" */
  plan: text("plan").notNull().default("free"),
  /** "trialing" | "active" | "past_due" | "canceled" | "incomplete" */
  status: text("status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
  /** Trial start (used to compute the 14-day window without a Stripe customer). */
  trialStartedAt: integer("trial_started_at", { mode: "timestamp_ms" }),
  /**
   * C-10 fix: last Stripe `event.created` ms timestamp we applied. The
   * webhook handler ignores patches whose `event.created * 1000 <
   * lastEventTs` to defeat out-of-order delivery.
   */
  lastEventTs: integer("last_event_ts"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

/**
 * In-app notifications — alerts for audit completion, payment issues, etc.
 *
 *   type   : "audit_complete" | "payment_issue" | "payment_resolved" | "welcome" | "system"
 *   read   : 0 (unread) | 1 (read)
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("system"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    /** Optional link to navigate when clicked */
    actionUrl: text("action_url"),
    /** 0 = unread, 1 = read (SQLite has no native booleans) */
    read: integer("read").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    unreadIdx: index("notifications_unread_idx").on(t.userId, t.read),
  }),
);

/**
 * Password reset tokens — hashed for security.
 * Raw token sent via email; only SHA-256 hash stored in DB.
 */
export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** SHA-256 hash of the raw token */
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

/**
 * C-10 fix: Stripe webhook event log for idempotent processing.
 * The webhook handler inserts on receive; ON CONFLICT means the event
 * has already been applied, so the handler short-circuits with 200.
 */
export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  /** Stripe's `event.created` (seconds since epoch) — used for ordering. */
  eventCreated: integer("event_created").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

/**
 * C-7 fix: audit run log for monthly audit-cap enforcement.
 * A row is inserted each time `runAudit*` runs from a request handler.
 */
export const auditRuns = sqliteTable(
  "audit_runs",
  {
    id: text("id").primaryKey(),
    agencyId: text("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    ranAt: integer("ran_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    agencyIdx: index("audit_runs_agency_idx").on(t.agencyId),
    ranAtIdx: index("audit_runs_ran_at_idx").on(t.ranAt),
  }),
);

/**
 * C-5 fix: agency logo binary storage (replaces public/logos/agency.*).
 * One row per agency. Served via /api/logos/agency/[agencyId].
 */
export const agencyLogos = sqliteTable("agency_logos", {
  agencyId: text("agency_id")
    .primaryKey()
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** image bytes */
  data: blob("data", { mode: "buffer" }).notNull(),
  /** "image/png" | "image/jpeg" | "image/webp" — no SVG (XSS risk). */
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

/**
 * C-5 fix: client logo binary storage (replaces public/csvs/<slug>/logo.*).
 * One row per client + variant (dark/light).
 */
export const clientLogos = sqliteTable(
  "client_logos",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** "dark" (default) or "light" theme variant. */
    variant: text("variant").notNull().default("dark"),
    data: blob("data", { mode: "buffer" }).notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    perClientVariant: uniqueIndex("client_logos_per_client_variant").on(t.clientId, t.variant),
  }),
);

/**
 * AI assistant — conversation threads scoped to (user, client).
 *
 * Each thread groups messages for one audit (clientId set) or for the
 * generic on-board assistant (clientId null). Persistence lets users
 * return to a thread later; the UI hides threads older than 90 days.
 */
export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null when the conversation isn't anchored to a specific client. */
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    /** Auto-derived from the first user message (truncated to ~60 chars). */
    title: text("title").notNull().default("New conversation"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index("ai_conversations_user_idx").on(t.userId),
    userClientIdx: index("ai_conversations_user_client_idx").on(t.userId, t.clientId),
  }),
);

/**
 * AI assistant — individual messages within a conversation.
 *
 * `role` is "user" | "assistant". `inputTokens` / `outputTokens` capture
 * Anthropic API usage for cost monitoring + rate limiting.
 */
export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    /** "user" | "assistant" */
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** Anthropic API token usage — null for user messages. */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    /** Cached-tokens reads — null for user messages or when no cache hit. */
    cacheReadTokens: integer("cache_read_tokens"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    conversationIdx: index("ai_messages_conversation_idx").on(t.conversationId),
    /** Per-user-per-month usage queries — covers the monthly tier cap. */
    userCreatedIdx: index("ai_messages_created_idx").on(t.createdAt),
  }),
);

/**
 * Bring-your-own Anthropic API key per agency (Agency tier feature).
 *
 * When present, the AI assistant uses this key instead of the server's
 * shared ANTHROPIC_API_KEY, so the agency pays Anthropic directly and
 * bypasses the per-tier message cap. The hourly throttle (30/hr/user)
 * still applies to prevent runaway loops.
 *
 * Key is stored AES-256-GCM-encrypted with the AI_KEY_ENCRYPTION_SECRET
 * server-side secret. `keyMask` is the human-readable last-4 suffix
 * shown in the UI; the plaintext key is never returned to the client.
 */
export const agencyAiConfigs = sqliteTable("agency_ai_configs", {
  agencyId: text("agency_id")
    .primaryKey()
    .references(() => agencies.id, { onDelete: "cascade" }),
  /** AES-256-GCM ciphertext, base64-encoded `iv:ciphertext:authTag`. */
  encryptedKey: text("encrypted_key").notNull(),
  /** Display-safe mask: "sk-ant-…abcd" (last 4 chars). */
  keyMask: text("key_mask").notNull(),
  /** 1 once we've successfully test-called the key. 0 otherwise. */
  validated: integer("validated").notNull().default(0),
  lastValidatedAt: integer("last_validated_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

/**
 * C-5 fix: Meta Marketing API credentials (replaces config/meta.json).
 * One row per agency.
 */
export const metaConfigs = sqliteTable("meta_configs", {
  agencyId: text("agency_id")
    .primaryKey()
    .references(() => agencies.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull(),
  appSecret: text("app_secret").notNull(),
  accessToken: text("access_token").notNull(),
  adAccountId: text("ad_account_id").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

// ─── Relations (for Drizzle's relational queries) ──────────────────────

export const agenciesRelations = relations(agencies, ({ many, one }) => ({
  users: many(users),
  clients: many(clients),
  subscription: one(subscriptions),
  logo: one(agencyLogos),
  metaConfig: one(metaConfigs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  agency: one(agencies, { fields: [users.agencyId], references: [agencies.id] }),
  notifications: many(notifications),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  agency: one(agencies, { fields: [clients.agencyId], references: [agencies.id] }),
  csvFiles: many(csvFiles),
  logos: many(clientLogos),
}));

export const csvFilesRelations = relations(csvFiles, ({ one }) => ({
  client: one(clients, { fields: [csvFiles.clientId], references: [clients.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  agency: one(agencies, { fields: [subscriptions.agencyId], references: [agencies.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// ─── Type exports ──────────────────────────────────────────────────────

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type CsvFile = typeof csvFiles.$inferSelect;
export type NewCsvFile = typeof csvFiles.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type AiConversation = typeof aiConversations.$inferSelect;
export type NewAiConversation = typeof aiConversations.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
export type AgencyAiConfig = typeof agencyAiConfigs.$inferSelect;
export type NewAgencyAiConfig = typeof agencyAiConfigs.$inferInsert;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
export type AuditRun = typeof auditRuns.$inferSelect;
export type NewAuditRun = typeof auditRuns.$inferInsert;
export type AgencyLogo = typeof agencyLogos.$inferSelect;
export type ClientLogo = typeof clientLogos.$inferSelect;
export type MetaConfig = typeof metaConfigs.$inferSelect;
export type NewMetaConfig = typeof metaConfigs.$inferInsert;

export type Role = "admin" | "agency";
export type BillingPlan = "free" | "pro" | "agency";
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type NotificationType =
  | "audit_complete"
  | "payment_issue"
  | "payment_resolved"
  | "welcome"
  | "system";
