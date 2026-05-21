/**
 * PATCH /api/agency — update agency branding (name / logoUrl / primaryColor).
 *
 * Agency users can only update their own agency. Admins can target any agency
 * via { agencyId } in the body.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * Returns 503 when AUTH_SECRET / DATABASE_URL are unset.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";

export async function PATCH(req: Request) {
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      {
        error:
          "Agency branding is disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    agencyId?: string;
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string;
  };

  // Resolve target agency
  let targetId = body.agencyId ?? session.user.agencyId ?? null;
  if (session.user.role !== "admin") {
    // Agency users can only update their own agency.
    targetId = session.user.agencyId ?? null;
  }
  if (!targetId) return NextResponse.json({ error: "No target agency" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) updates.name = body.name.trim();
  if (body.logoUrl === null || typeof body.logoUrl === "string") updates.logoUrl = body.logoUrl || null;
  if (typeof body.primaryColor === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(body.primaryColor)) {
    updates.primaryColor = body.primaryColor;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(schema.agencies).set(updates).where(eq(schema.agencies.id, targetId));
  const fresh = await db.select().from(schema.agencies).where(eq(schema.agencies.id, targetId)).limit(1);
  return NextResponse.json(fresh[0] ?? { ok: true });
}
