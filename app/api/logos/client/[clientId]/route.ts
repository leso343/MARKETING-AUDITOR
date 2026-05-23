/**
 * GET /api/logos/client/[clientId]?v=dark|light — serve the DB-backed
 * client logo. Public (no auth) for the same reason as agency logos:
 * the audit dashboards are render-by-URL and the logos are not sensitive.
 *
 * Part of the C-5 fix.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  if (!dbAvailable) return new NextResponse("Not Found", { status: 404 });
  const { clientId } = await params;
  if (!clientId || !/^[a-zA-Z0-9-]+$/.test(clientId)) {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const url = new URL(req.url);
  const v = url.searchParams.get("v");
  const variant = v === "light" ? "light" : "dark";
  let rows = await db
    .select()
    .from(schema.clientLogos)
    .where(and(eq(schema.clientLogos.clientId, clientId), eq(schema.clientLogos.variant, variant)))
    .limit(1);
  // Fallback to the dark variant if light is requested but not present.
  if (rows.length === 0 && variant === "light") {
    rows = await db
      .select()
      .from(schema.clientLogos)
      .where(and(eq(schema.clientLogos.clientId, clientId), eq(schema.clientLogos.variant, "dark")))
      .limit(1);
  }
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
