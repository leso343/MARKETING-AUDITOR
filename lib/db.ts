/**
 * Tier 3 — Drizzle ORM client over libsql.
 *
 * libsql is the SQLite-compatible driver from Turso. Same client connects to:
 *   - local file (dev):  DATABASE_URL="file:./data/dev.db"
 *   - Turso (prod):      DATABASE_URL="libsql://<your-db>.turso.io"
 *                        DATABASE_AUTH_TOKEN="<turso token>"
 *
 * Postgres deployment: swap to drizzle-orm/postgres-js with a small driver change.
 * See README "Deploy" section.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL ?? "file:./data/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

// Reuse a single client across Next.js hot-reloads in dev.
const globalForDb = globalThis as unknown as {
  __libsqlClient?: Client;
};

const client =
  globalForDb.__libsqlClient ??
  createClient({ url, authToken });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__libsqlClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
