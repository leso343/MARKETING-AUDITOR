/**
 * Tier 3 — access control helpers.
 *
 * Auth → list/lookup clients scoped to the session user's agency
 * (admins see everything).
 */
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "agency";
  agencyId: string | null;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Return the agency (if any) attached to the session user. */
export async function getCurrentAgency() {
  const user = await requireUser();
  if (!user.agencyId) return null;
  const rows = await db.select().from(schema.agencies).where(eq(schema.agencies.id, user.agencyId)).limit(1);
  return rows[0] ?? null;
}

/** List clients the session user is allowed to see. */
export async function listVisibleClients() {
  const user = await requireUser();
  if (user.role === "admin") {
    return db.select().from(schema.clients);
  }
  if (!user.agencyId) return [];
  return db.select().from(schema.clients).where(eq(schema.clients.agencyId, user.agencyId));
}

/** Resolve a client by slug, gated by access. Returns null if not visible. */
export async function getVisibleClientBySlug(slug: string) {
  const user = await requireUser();
  const rows = await db.select().from(schema.clients).where(eq(schema.clients.slug, slug)).limit(1);
  const client = rows[0];
  if (!client) return null;
  if (user.role === "admin") return client;
  if (client.agencyId !== user.agencyId) return null;
  return client;
}

/** List CSV files for a client. */
export async function listClientCsvs(clientId: string) {
  return db.select().from(schema.csvFiles).where(eq(schema.csvFiles.clientId, clientId));
}

/** Find user's agency or null. */
export async function getAgencyById(id: string) {
  const rows = await db.select().from(schema.agencies).where(eq(schema.agencies.id, id)).limit(1);
  return rows[0] ?? null;
}

export { and, eq };
