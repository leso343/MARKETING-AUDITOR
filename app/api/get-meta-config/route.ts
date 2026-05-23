/**
 * GET /api/get-meta-config — return the Meta API config for the caller's
 * agency, with secrets masked. C-5 fix: was reading from
 * config/meta.json on disk (broken on Vercel — ephemeral FS).
 *
 * Admin only.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { log } from "@/lib/logger";

function mask(val: string | null | undefined): string {
  return val ? "••••••••" : "";
}

export async function GET() {
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
      return NextResponse.json({ appId: "", appSecret: "", accessToken: "", adAccountId: "", configured: false });
    }

    const rows = await db
      .select()
      .from(schema.metaConfigs)
      .where(eq(schema.metaConfigs.agencyId, agencyId))
      .limit(1);
    const config = rows[0];
    if (!config) {
      return NextResponse.json({ appId: "", appSecret: "", accessToken: "", adAccountId: "", configured: false });
    }
    return NextResponse.json({
      appId: config.appId ?? "",
      appSecret: mask(config.appSecret),
      accessToken: mask(config.accessToken),
      adAccountId: config.adAccountId ?? "",
      configured: !!(config.appId && config.appSecret && config.accessToken && config.adAccountId),
    });
  } catch (err) {
    log.error("Failed to read Meta config", err);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}
