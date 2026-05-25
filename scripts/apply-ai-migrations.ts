/**
 * Manually apply the AI assistant migrations (0002 + 0003) to prod.
 *
 * drizzle-kit push reported success but didn't actually create the
 * tables on Turso — running the SQL via the libsql client directly
 * to guarantee creation. Each statement is idempotent (IF NOT EXISTS).
 *
 * Run: npx tsx --env-file=.env.local scripts/apply-ai-migrations.ts
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

async function applyMigration(file: string) {
  console.log(`\n[apply] ${file}`);
  const fullPath = path.resolve(file);
  const text = fs.readFileSync(fullPath, "utf8");
  // Split on the drizzle-kit statement delimiter, then strip comments
  // and empty fragments. Each remaining fragment is one SQL statement.
  const statements = text
    .split("--> statement-breakpoint")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const [i, stmt] of statements.entries()) {
    const preview = stmt.split("\n")[0].slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}… `);
    try {
      await db.run(sql.raw(stmt));
      console.log("✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        console.log("(already exists)");
      } else {
        console.log(`❌ ${msg}`);
        throw err;
      }
    }
  }
}

async function main() {
  await applyMigration("db/migrations/0002_ai_assistant.sql");
  await applyMigration("db/migrations/0003_agency_ai_byo.sql");

  console.log("\n[verify] confirming tables exist now:");
  const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  const names = (tables as Array<{ name: string }>).map((t) => t.name);
  for (const t of ["ai_conversations", "ai_messages", "agency_ai_configs"]) {
    console.log(`  ${names.includes(t) ? "✓" : "❌"} ${t}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("\nfailed:", e); process.exit(1); });
