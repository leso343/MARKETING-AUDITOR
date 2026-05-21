/**
 * POST /api/clients — create a new client under the session user's agency.
 *
 * Admins can specify agencyId in the body; agency users always create under
 * their own agency.
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { randomUUID } from "node:crypto";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function POST(req: Request) {
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

  // Choose target agency:
  //   - admin: explicit agencyId required (or fall back to their own)
  //   - agency: always their own agency
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
