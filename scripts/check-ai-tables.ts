/**
 * Diagnostic — confirm the AI assistant tables exist in prod Turso and
 * that a count query against them actually works.
 *
 * Run: npx tsx --env-file=.env.local scripts/check-ai-tables.ts
 */
import { db, schema } from "../lib/db";
import { sql, count, eq, and, gte } from "drizzle-orm";

async function main() {
  console.log("[check] listing tables in prod DB:");
  const tables = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  const names = (tables as Array<{ name: string }>).map((t) => t.name);
  const want = ["ai_conversations", "ai_messages", "agency_ai_configs"];
  for (const t of want) {
    console.log(`  ${names.includes(t) ? "✓" : "❌"} ${t}`);
  }

  console.log("\n[check] columns on ai_messages:");
  const cols = await db.all(sql`PRAGMA table_info("ai_messages")`);
  for (const c of cols as Array<{ name: string; type: string }>) {
    console.log(`  ${c.name}  (${c.type})`);
  }

  console.log("\n[check] columns on ai_conversations:");
  const cols2 = await db.all(sql`PRAGMA table_info("ai_conversations")`);
  for (const c of cols2 as Array<{ name: string; type: string }>) {
    console.log(`  ${c.name}  (${c.type})`);
  }

  console.log("\n[check] sample count query (the one that failed):");
  try {
    const rows = await db
      .select({ n: count() })
      .from(schema.aiMessages)
      .innerJoin(
        schema.aiConversations,
        eq(schema.aiMessages.conversationId, schema.aiConversations.id),
      )
      .where(
        and(
          eq(schema.aiConversations.userId, "18c34125-3c2c-4fa4-8e47-51b49637d4dc"),
          eq(schema.aiMessages.role, "user"),
          gte(schema.aiMessages.createdAt, new Date(0)),
        ),
      );
    console.log(`  ✓ query OK — result: ${JSON.stringify(rows)}`);
  } catch (err) {
    console.log(`  ❌ query FAILED:`);
    console.log(`     ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.cause) {
      console.log(`     cause: ${String(err.cause)}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
