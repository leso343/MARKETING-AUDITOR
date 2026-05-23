/**
 * /api/agencies
 *   GET    — list all agencies (admin only).
 *   POST   — create a new agency (admin only).
 *   PATCH  — update an agency's name/slug/branding.
 *   DELETE — delete an agency (admin only, cascades clients).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidHex(v: unknown): boolean {
  return typeof v === "string" && HEX_COLOR_RE.test(v.trim());
}

function guard() {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      { error: "Agency management requires AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }
  return null;
}

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  if (session.user.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }), user: null };
  return { error: null, user: session.user };
}

/* ── GET — list agencies ─────────────────────────────────────────────── */

export async function GET() {
  const g = guard();
  if (g) return g;

  const { error } = await requireAdminSession();
  if (error) return error;

  const agencies = await db.select().from(schema.agencies);
  return NextResponse.json(agencies);
}

/* ── POST — create agency ────────────────────────────────────────────── */

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;

  const { error } = await requireAdminSession();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    logoUrl?: string;
    primaryColor?: string;
  };

  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json({ error: "name is required (min 2 chars)" }, { status: 400 });
  }

  const slug = (body.slug && slugify(body.slug)) || slugify(body.name);
  if (!slug) return NextResponse.json({ error: "could not derive slug" }, { status: 400 });

  const existing = await db.select().from(schema.agencies).where(eq(schema.agencies.slug, slug)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: `slug "${slug}" already exists` }, { status: 409 });
  }

  const id = randomUUID();
  await db.insert(schema.agencies).values({
    id,
    slug,
    name: body.name.trim(),
    logoUrl: body.logoUrl?.trim() || null,
    primaryColor: body.primaryColor?.trim() || "#ff0000",
  });

  return NextResponse.json({ id, slug, name: body.name.trim() }, { status: 201 });
}

/* ── PATCH — update agency ───────────────────────────────────────────── */

export async function PATCH(req: Request) {
  const g = guard();
  if (g) return g;

  const { error } = await requireAdminSession();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    agencyId?: string;
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string | null;
    accentColor?: string | null;
    highlightColor?: string | null;
    popColor?: string | null;
  };

  if (!body.agencyId) {
    return NextResponse.json({ error: "agencyId is required" }, { status: 400 });
  }

  const rows = await db.select().from(schema.agencies).where(eq(schema.agencies.id, body.agencyId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  // Validate hex colors before applying
  const colorFields = ["primaryColor", "secondaryColor", "accentColor", "highlightColor", "popColor"] as const;
  for (const field of colorFields) {
    const val = body[field];
    if (val !== null && val !== undefined && typeof val === "string" && val.trim() !== "" && !isValidHex(val)) {
      return NextResponse.json({ error: `Invalid hex color for ${field}: "${val}"` }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) updates.name = body.name.trim();
  if (body.logoUrl === null) updates.logoUrl = null;
  else if (typeof body.logoUrl === "string") updates.logoUrl = body.logoUrl.trim() || null;
  if (typeof body.primaryColor === "string" && isValidHex(body.primaryColor)) updates.primaryColor = body.primaryColor.trim();
  if (body.secondaryColor === null) updates.secondaryColor = null;
  else if (typeof body.secondaryColor === "string" && isValidHex(body.secondaryColor)) updates.secondaryColor = body.secondaryColor.trim();
  if (body.accentColor === null) updates.accentColor = null;
  else if (typeof body.accentColor === "string" && isValidHex(body.accentColor)) updates.accentColor = body.accentColor.trim();
  if (body.highlightColor === null) updates.highlightColor = null;
  else if (typeof body.highlightColor === "string" && isValidHex(body.highlightColor)) updates.highlightColor = body.highlightColor.trim();
  if (body.popColor === null) updates.popColor = null;
  else if (typeof body.popColor === "string" && isValidHex(body.popColor)) updates.popColor = body.popColor.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.agencies).set(updates).where(eq(schema.agencies.id, body.agencyId));
  const fresh = await db.select().from(schema.agencies).where(eq(schema.agencies.id, body.agencyId)).limit(1);
  return NextResponse.json(fresh[0] ?? { ok: true });
}

/* ── DELETE — delete agency ──────────────────────────────────────────── */

export async function DELETE(req: Request) {
  const g = guard();
  if (g) return g;

  const { error } = await requireAdminSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const agencyId = searchParams.get("agencyId");
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId query param required" }, { status: 400 });
  }

  const rows = await db.select().from(schema.agencies).where(eq(schema.agencies.id, agencyId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  await db.delete(schema.agencies).where(eq(schema.agencies.id, agencyId));
  return NextResponse.json({ ok: true, deleted: rows[0].slug });
}
