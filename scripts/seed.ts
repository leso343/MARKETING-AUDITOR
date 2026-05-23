/**
 * Seed admin + Blank Page Audits + Take Charge Roofing.
 *
 * Idempotent — running twice is safe; it upserts by email/slug.
 *
 * Run: `npm run db:seed`
 *
 * Note: This seeds the *client record* for take-charge-roofing so it shows
 * up in the dashboard list under Blank Page Audits. The actual CSV data still
 * lives on disk at public/csvs/take-charge-roofing/ — the audit page falls
 * back to filesystem when a client has no rows in csv_files. This preserves
 * the $3,137.11 / 31 leads baseline reconciliation without re-uploading.
 */
import { db, schema } from "../lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "lesterortiz39@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "changeme";

async function upsertAgency(slug: string, name: string, primaryColor = "#ff0000") {
  const found = await db.select().from(schema.agencies).where(eq(schema.agencies.slug, slug)).limit(1);
  if (found[0]) {
    await db.update(schema.agencies).set({ name, primaryColor }).where(eq(schema.agencies.id, found[0].id));
    return found[0];
  }
  // Also check for legacy slug and rename it
  const legacy = await db.select().from(schema.agencies).where(eq(schema.agencies.slug, "sna-marketing")).limit(1);
  if (legacy[0]) {
    await db.update(schema.agencies).set({ slug, name, primaryColor }).where(eq(schema.agencies.id, legacy[0].id));
    return legacy[0];
  }
  const id = randomUUID();
  await db.insert(schema.agencies).values({ id, slug, name, primaryColor });
  // Return the known values directly (avoids Turso replication lag on select-after-insert)
  return { id, slug, name, primaryColor } as typeof schema.agencies.$inferSelect;
}

async function upsertUser(email: string, password: string, role: "admin" | "agency", agencyId?: string, name?: string) {
  const found = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const passwordHash = await bcrypt.hash(password, 12);
  if (found[0]) {
    await db.update(schema.users).set({ passwordHash, role, agencyId: agencyId ?? null, name: name ?? found[0].name }).where(eq(schema.users.id, found[0].id));
    return found[0];
  }
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email, passwordHash, role, agencyId: agencyId ?? null, name });
  return { id, email, passwordHash, role, agencyId: agencyId ?? null, name } as typeof schema.users.$inferSelect;
}

async function upsertClient(slug: string, name: string, agencyId: string, opts: { subtitle?: string; industry?: string } = {}) {
  const found = await db.select().from(schema.clients).where(eq(schema.clients.slug, slug)).limit(1);
  if (found[0]) {
    await db.update(schema.clients).set({ name, agencyId, ...opts }).where(eq(schema.clients.id, found[0].id));
    return found[0];
  }
  const id = randomUUID();
  await db.insert(schema.clients).values({ id, slug, name, agencyId, ...opts });
  return { id, slug, name, agencyId, ...opts } as typeof schema.clients.$inferSelect;
}

async function ensureSubscription(agencyId: string) {
  const found = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.agencyId, agencyId)).limit(1);
  if (found[0]) return found[0];
  const id = randomUUID();
  await db.insert(schema.subscriptions).values({ id, agencyId, plan: "free", status: "trialing" });
  return { id, agencyId, plan: "free", status: "trialing" } as typeof schema.subscriptions.$inferSelect;
}

async function main() {
  console.log("[seed] agency: Blank Page Audits");
  const sna = await upsertAgency("blank-page-audits", "Blank Page Audits", "#ff0000");

  console.log(`[seed] admin user: ${ADMIN_EMAIL}`);
  await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, "admin", sna.id, "Lester Ortiz");

  // L-10 fix: only seed the demo client in dev / when explicitly
  // requested. Production deploys should start clean.
  if (process.env.SEED_INCLUDE_DEMO === "true" || process.env.NODE_ENV !== "production") {
    console.log("[seed] client: Take Charge Roofing under Blank Page Audits");
    await upsertClient("take-charge-roofing", "Take Charge Roofing", sna.id, {
      subtitle: "Roofing · Atlanta",
      industry: "roofing",
    });
  } else {
    console.log("[seed] skipping demo client (set SEED_INCLUDE_DEMO=true to include)");
  }

  console.log("[seed] subscription: BPA → free / trialing");
  await ensureSubscription(sna.id);

  console.log("[seed] done ✓");
  console.log("");
  console.log("    Login at /login with:");
  console.log(`      email:    ${ADMIN_EMAIL}`);
  // M-4 fix: do NOT echo the password. Whoever ran the seed knows it
  // (they set SEED_ADMIN_PASSWORD or used the default in this file).
  console.log("      password: <use SEED_ADMIN_PASSWORD or the default>");
  console.log("");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
