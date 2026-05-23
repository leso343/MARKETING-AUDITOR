/**
 * POST /api/save-meta-config — store Meta Marketing API credentials
 * for the caller's agency.
 *
 * Admin only. C-5 fix: was writing to config/meta.json on disk; now
 * upserts a meta_configs row keyed by agencyId.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { log } from "@/lib/logger";

const MAX_FIELD_LEN = 1024;

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > MAX_FIELD_LEN) return null;
  return t;
}

export async function POST(req: NextRequest) {
  try {
    if (!authEnabled || !dbAvailable) {
      return NextResponse.json(
        { error: "Multi-tenant features required (AUTH_SECRET + DATABASE_URL)." },
        { status: 503 },
      );
    }
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const agencyId = session.user.agencyId;
    if (!agencyId) {
      return NextResponse.json({ error: "Your user isn't attached to an agency." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      appId?: unknown;
      appSecret?: unknown;
      accessToken?: unknown;
      adAccountId?: unknown;
    };
    const appId = s(body.appId);
    const appSecret = s(body.appSecret);
    const accessToken = s(body.accessToken);
    const adAccountId = s(body.adAccountId);
    if (!appId || !appSecret || !accessToken || !adAccountId) {
      return NextResponse.json({ error: "All four fields are required." }, { status: 400 });
    }

    const existing = await db
      .select({ agencyId: schema.metaConfigs.agencyId })
      .from(schema.metaConfigs)
      .where(eq(schema.metaConfigs.agencyId, agencyId))
      .limit(1);
    if (existing[0]) {
      await db
        .update(schema.metaConfigs)
        .set({ appId, appSecret, accessToken, adAccountId, updatedAt: new Date() })
        .where(eq(schema.metaConfigs.agencyId, agencyId));
    } else {
      await db.insert(schema.metaConfigs).values({
        agencyId,
        appId,
        appSecret,
        accessToken,
        adAccountId,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Failed to save Meta config", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
