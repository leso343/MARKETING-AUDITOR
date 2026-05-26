/**
 * Applies the agency-surface-overrides migration:
 *   ALTER TABLE agencies ADD COLUMN card_color text
 *   ALTER TABLE agencies ADD COLUMN border_color text
 *   ALTER TABLE agencies ADD COLUMN text_color text
 *
 * Run against local SQLite OR Turso via DATABASE_URL.
 *
 * Usage:
 *   npx tsx scripts/apply-surface-overrides-migration.ts
 *
 * Idempotent — re-running is safe (no-ops on already-existing columns).
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

const COLUMNS = ["card_color", "border_color", "text_color"];

async function main() {
  console.log("[apply] 0005_agency_surface_overrides.sql");
  for (const col of COLUMNS) {
    try {
      await db.run(sql.raw(`ALTER TABLE agencies ADD COLUMN ${col} text`));
      console.log(`  ✓ ${col} column added`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        console.log(`  (${col} already exists — no-op)`);
      } else {
        throw e;
      }
    }
  }
  const cols = await db.all(sql`PRAGMA table_info("agencies")`);
  const names = (cols as Array<{ name: string }>).map((c) => c.name);
  for (const col of COLUMNS) {
    console.log(`  ✓ verified — ${col} present: ${names.includes(col)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
