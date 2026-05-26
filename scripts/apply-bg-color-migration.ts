import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply] 0004_agency_bg_color.sql");
  try {
    await db.run(sql`ALTER TABLE agencies ADD COLUMN bg_color text`);
    console.log("  ✓ bg_color column added");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      console.log("  (column already exists — no-op)");
    } else {
      throw e;
    }
  }
  const cols = await db.all(sql`PRAGMA table_info("agencies")`);
  const names = (cols as Array<{ name: string }>).map((c) => c.name);
  console.log(`  ✓ verified — bg_color present: ${names.includes("bg_color")}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
