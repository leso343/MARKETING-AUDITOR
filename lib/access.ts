/**
 * Tier 3 — access control helpers.
 *
 * Auth → list/lookup clients scoped to the session user's agency
 * (admins see everything).
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * Every helper that touches the DB or session short-circuits when either
 *   - AUTH_SECRET is unset (`authEnabled === false`) or
 *   - DATABASE_URL is unset (`dbAvailable === false`).
 * In that mode they return safe defaults (`null`, `[]`) so callers fall
 * through to the legacy filesystem code path instead of 500-ing.
 *
 * `requireUser` / `requireAdmin` redirect to `/` (the no-auth home) when
 * auth is disabled — admin-only pages effectively become inaccessible
 * without crashing the request.
 */
import { auth, authEnabled } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "agency";
  agencyId: string | null;
};

/** Soft-read the current user. Returns null when no session / no auth. */
export async function tryGetUser(): Promise<SessionUser | null> {
  if (!authEnabled) return null;
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  // When auth is disabled, the app is in legacy single-tenant mode. Bounce
  // admin-only routes to the no-auth home rather than to /login (which
  // can't actually authenticate anything in this mode).
  if (!authEnabled) redirect("/");
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
  if (!authEnabled || !dbAvailable) return null;
  const user = await tryGetUser();
  if (!user?.agencyId) return null;
  const rows = await db
    .select()
    .from(schema.agencies)
    .where(eq(schema.agencies.id, user.agencyId))
    .limit(1);
  return rows[0] ?? null;
}

/** List clients the session user is allowed to see. */
export async function listVisibleClients() {
  if (!authEnabled || !dbAvailable) return [];
  const user = await tryGetUser();
  if (!user) return [];
  if (user.role === "admin") {
    return db.select().from(schema.clients);
  }
  if (!user.agencyId) return [];
  return db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.agencyId, user.agencyId));
}

/** Resolve a client by slug, gated by access. Returns null if not visible. */
export async function getVisibleClientBySlug(slug: string) {
  if (!authEnabled || !dbAvailable) return null;
  const user = await tryGetUser();
  if (!user) return null;
  const rows = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.slug, slug))
    .limit(1);
  const client = rows[0];
  if (!client) return null;
  if (user.role === "admin") return client;
  if (client.agencyId !== user.agencyId) return null;
  return client;
}

/** List CSV files for a client. */
export async function listClientCsvs(clientId: string) {
  if (!dbAvailable) return [];
  return db
    .select()
    .from(schema.csvFiles)
    .where(eq(schema.csvFiles.clientId, clientId));
}

/** Find user's agency or null. */
export async function getAgencyById(id: string) {
  if (!dbAvailable) return null;
  const rows = await db
    .select()
    .from(schema.agencies)
    .where(eq(schema.agencies.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export { and, eq };
