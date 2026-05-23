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
  if (found[0]) return found[0];
  const id = randomUUID();
  await db.insert(schema.agencies).values({ id, slug, name, primaryColor });
  return (await db.select().from(schema.agencies).where(eq(schema.agencies.id, id)).limit(1))[0]!;
}

async function upsertUser(email: string, password: string, role: "admin" | "agency", agencyId?: string, name?: string) {
  const found = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const passwordHash = await bcrypt.hash(password, 10);
  if (found[0]) {
    await db.update(schema.users).set({ passwordHash, role, agencyId: agencyId ?? null, name: name ?? found[0].name }).where(eq(schema.users.id, found[0].id));
    return found[0];
  }
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email, passwordHash, role, agencyId: agencyId ?? null, name });
  return (await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1))[0]!;
}

async function upsertClient(slug: string, name: string, agencyId: string, opts: { subtitle?: string; industry?: string } = {}) {
  const found = await db.select().from(schema.clients).where(eq(schema.clients.slug, slug)).limit(1);
  if (found[0]) {
    await db.update(schema.clients).set({ name, agencyId, ...opts }).where(eq(schema.clients.id, found[0].id));
    return found[0];
  }
  const id = randomUUID();
  await db.insert(schema.clients).values({ id, slug, name, agencyId, ...opts });
  return (await db.select().from(schema.clients).where(eq(schema.clients.id, id)).limit(1))[0]!;
}

async function ensureSubscription(agencyId: string) {
  const found = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.agencyId, agencyId)).limit(1);
  if (found[0]) return found[0];
  const id = randomUUID();
  await db.insert(schema.subscriptions).values({ id, agencyId, plan: "free", status: "trialing" });
  return (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1))[0]!;
}

async function main() {
  console.log("[seed] agency: Blank Page Audits");
  const sna = await upsertAgency("blank-page-audits", "Blank Page Audits", "#ff0000");

  console.log(`[seed] admin user: ${ADMIN_EMAIL}`);
  await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, "admin", sna.id, "Lester Ortiz");

  console.log("[seed] client: Take Charge Roofing under Blank Page Audits");
  await upsertClient("take-charge-roofing", "Take Charge Roofing", sna.id, {
    subtitle: "Roofing · Atlanta",
    industry: "roofing",
  });

  console.log("[seed] subscription: SNA → free / trialing");
  await ensureSubscription(sna.id);

  console.log("[seed] done ✓");
  console.log("");
  console.log("    Login at /login with:");
  console.log(`      email:    ${ADMIN_EMAIL}`);
  console.log(`      password: ${ADMIN_PASSWORD}`);
  console.log("");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
