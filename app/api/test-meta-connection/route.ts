/**
 * GET /api/test-meta-connection — verify the saved Meta credentials
 * by calling /me. Admin only.
 *
 * M-7 fix: third-party error message no longer echoed verbatim
 * (Meta's errors can include the access token itself).
 * C-5 fix: pulls credentials from meta_configs, not config/meta.json.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    if (!authEnabled || !dbAvailable) {
      return NextResponse.json(
        { ok: false, error: "Multi-tenant features required." },
        { status: 503 },
      );
    }
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const agencyId = session.user.agencyId;
    if (!agencyId) {
      return NextResponse.json({ ok: false, error: "Your user isn't attached to an agency." });
    }

    const rows = await db
      .select()
      .from(schema.metaConfigs)
      .where(eq(schema.metaConfigs.agencyId, agencyId))
      .limit(1);
    const config = rows[0];
    if (!config) {
      return NextResponse.json({ ok: false, error: "No config saved. Please save credentials first." });
    }
    const accessToken = config.accessToken;

    const url = `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const data = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };

    if (!res.ok || data.error) {
      // M-7 fix: log full detail server-side, return generic message
      // to the client (Meta's error often echoes the token).
      log.warn("Meta connection test failed", { status: res.status, metaError: data.error?.message ?? "" });
      return NextResponse.json({ ok: false, error: "Connection failed — your token may be expired, scoped wrong, or revoked." });
    }
    return NextResponse.json({ ok: true, name: data.name ?? "Unknown" });
  } catch (err) {
    log.error("Meta connection test failed", err);
    return NextResponse.json({ ok: false, error: "Internal error testing connection." });
  }
}
