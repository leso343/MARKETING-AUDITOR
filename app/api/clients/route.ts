/**
 * /api/clients
 *   POST  — create a new client under the session user's agency.
 *   PATCH — update a client's name / subtitle / industry.
 *   DELETE — delete a client and all its CSV files.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * Returns 503 when AUTH_SECRET / DATABASE_URL are unset.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function guard() {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      { error: "Client management requires AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }
  return null;
}

/* ── POST — create client ─────────────────────────────────────────────── */

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    subtitle?: string;
    industry?: string;
    agencyId?: string;
  };

  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json({ error: "name is required (min 2 chars)" }, { status: 400 });
  }

  const slug = (body.slug && slugify(body.slug)) || slugify(body.name);
  if (!slug) return NextResponse.json({ error: "could not derive slug" }, { status: 400 });

  let agencyId: string | null = null;
  if (session.user.role === "admin") {
    agencyId = body.agencyId ?? session.user.agencyId ?? null;
  } else {
    agencyId = session.user.agencyId ?? null;
  }
  if (!agencyId) {
    return NextResponse.json({ error: "no target agency (user has no agency assigned)" }, { status: 400 });
  }

  const existing = await db.select().from(schema.clients).where(eq(schema.clients.slug, slug)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: `slug "${slug}" already exists` }, { status: 409 });
  }

  const id = randomUUID();
  await db.insert(schema.clients).values({
    id,
    slug,
    name: body.name.trim(),
    subtitle: body.subtitle?.trim() || null,
    industry: body.industry?.trim() || "roofing",
    agencyId,
  });

  return NextResponse.json({ id, slug, name: body.name, agencyId }, { status: 201 });
}

/* ── PATCH — update client ────────────────────────────────────────────── */

export async function PATCH(req: Request) {
  const g = guard();
  if (g) return g;

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    name?: string;
    subtitle?: string | null;
    industry?: string;
  };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  // Verify access
  const rows = await db.select().from(schema.clients).where(eq(schema.clients.id, body.clientId)).limit(1);
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (session.user.role !== "admin" && client.agencyId !== session.user.agencyId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) updates.name = body.name.trim();
  if (body.subtitle === null) updates.subtitle = null;
  else if (typeof body.subtitle === "string") updates.subtitle = body.subtitle.trim() || null;
  if (typeof body.industry === "string" && body.industry.trim()) updates.industry = body.industry.trim();
  updates.updatedAt = new Date();

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.clients).set(updates).where(eq(schema.clients.id, body.clientId));
  const fresh = await db.select().from(schema.clients).where(eq(schema.clients.id, body.clientId)).limit(1);
  return NextResponse.json(fresh[0] ?? { ok: true });
}

/* ── DELETE — delete client ───────────────────────────────────────────── */

export async function DELETE(req: Request) {
  const g = guard();
  if (g) return g;

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId query param required" }, { status: 400 });
  }

  const rows = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (session.user.role !== "admin" && client.agencyId !== session.user.agencyId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Cascade: csv_files have ON DELETE CASCADE, so just deleting the client works
  await db.delete(schema.clients).where(eq(schema.clients.id, clientId));

  return NextResponse.json({ ok: true, deleted: client.slug });
}
