/**
 * GET /api/logos/agency/[agencyId] — serve the DB-backed agency logo.
 * Public (no auth) — logos are not sensitive; they're shown on the
 * public-facing audit dashboards. Cached briefly.
 *
 * Part of the C-5 fix (FS writes broken on Vercel).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  if (!dbAvailable) return new NextResponse("Not Found", { status: 404 });
  const { agencyId } = await params;
  if (!agencyId || !/^[a-zA-Z0-9-]+$/.test(agencyId)) {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const rows = await db
    .select()
    .from(schema.agencyLogos)
    .where(eq(schema.agencyLogos.agencyId, agencyId))
    .limit(1);
  const logo = rows[0];
  if (!logo) return new NextResponse("Not Found", { status: 404 });
  return new NextResponse(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.mime,
      "Content-Length": String(logo.size),
      "Cache-Control": "public, max-age=300, immutable",
    },
  });
}
