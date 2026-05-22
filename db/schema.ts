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
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const agencies = sqliteTable("agencies", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#ff0000"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
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
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

// ─── Relations (for Drizzle's relational queries) ──────────────────────

export const agenciesRelations = relations(agencies, ({ many, one }) => ({
  users: many(users),
  clients: many(clients),
  subscription: one(subscriptions),
}));

export const usersRelations = relations(users, ({ one }) => ({
  agency: one(agencies, { fields: [users.agencyId], references: [agencies.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  agency: one(agencies, { fields: [clients.agencyId], references: [agencies.id] }),
  csvFiles: many(csvFiles),
}));

export const csvFilesRelations = relations(csvFiles, ({ one }) => ({
  client: one(clients, { fields: [csvFiles.clientId], references: [clients.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  agency: one(agencies, { fields: [subscriptions.agencyId], references: [agencies.id] }),
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

export type Role = "admin" | "agency";
export type BillingPlan = "free" | "pro" | "agency";
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
