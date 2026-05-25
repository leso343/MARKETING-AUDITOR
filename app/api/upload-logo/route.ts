/**
 * POST /api/upload-logo — upload a logo for the caller's agency or one of
 * their clients. Stores bytes in DB (agency_logos / client_logos) and
 * returns a URL pointing at /api/logos/* which serves the bytes back.
 *
 * Fixes folded in:
 *   - C-2: agency-scope check on `target=client` (via getVisibleClientBySlug).
 *          `target=agency` writes to the caller's OWN agency, never a
 *          global singleton.
 *   - C-5: no more fs.writeFileSync into public/ — Vercel's serverless
 *          FS is ephemeral and read-only at runtime.
 *   - H-5: slug regex case-folded + strict (no /gi).
 *   - M-14: image/svg+xml dropped from the allowlist (SVG can XSS).
 *
 * Body (multipart):
 *   file:        the image
 *   target:      "agency" | "client"
 *   clientSlug:  required when target=client
 *   variant:     "dark" (default) | "light" — only meaningful for client
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getVisibleClientBySlug } from "@/lib/access";
import { safeSlug } from "@/lib/billing-access";
import { log } from "@/lib/logger";

import { isSameOriginRequest, csrfRejection } from "@/lib/api-helpers";
// M-14 fix: no SVG. SVGs can carry inline <script>; even if rendered
// via <img> the file can be opened directly in a new tab.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) return csrfRejection();
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!dbAvailable) {
      return NextResponse.json(
        { error: "Database unavailable — DB-backed logo storage requires DATABASE_URL." },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const target = String(formData.get("target") ?? "");
    const clientSlugRaw = formData.get("clientSlug");
    const variantRaw = String(formData.get("variant") ?? "dark");
    const variant = variantRaw === "light" ? "light" : "dark";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (target !== "agency" && target !== "client") {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    const mime = ALLOWED_TYPES[file.type];
    if (!mime) {
      return NextResponse.json(
        { error: "Invalid file type. Use PNG, JPG, or WEBP." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 2 MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (target === "agency") {
      // C-2 fix: write into the caller's OWN agency, not a global path.
      const agencyId = session.user.agencyId;
      if (!agencyId && session.user.role !== "admin") {
        return NextResponse.json(
          { error: "Your user isn't attached to an agency." },
          { status: 400 },
        );
      }
      const targetAgencyId =
        session.user.role === "admin"
          ? String(formData.get("agencyId") ?? agencyId ?? "")
          : (agencyId as string);
      if (!targetAgencyId) {
        return NextResponse.json({ error: "No target agency." }, { status: 400 });
      }
      // Upsert the agency_logos row.
      await db.delete(schema.agencyLogos).where(eq(schema.agencyLogos.agencyId, targetAgencyId));
      await db.insert(schema.agencyLogos).values({
        agencyId: targetAgencyId,
        data: buffer,
        mime,
        size: buffer.length,
      });
      const url = `/api/logos/agency/${targetAgencyId}?v=${Date.now()}`;
      // Also update legacy logoUrl column so existing renderers pick it up.
      await db.update(schema.agencies).set({ logoUrl: url }).where(eq(schema.agencies.id, targetAgencyId));
      return NextResponse.json({ ok: true, url });
    }

    // target === "client"
    if (typeof clientSlugRaw !== "string") {
      return NextResponse.json({ error: "clientSlug required for client target" }, { status: 400 });
    }
    const slug = safeSlug(clientSlugRaw);
    if (!slug) {
      return NextResponse.json({ error: "Invalid clientSlug." }, { status: 400 });
    }
    // C-2 fix: scope-check the slug against the caller's agency.
    const client = await getVisibleClientBySlug(slug);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // Upsert the client_logos row for (clientId, variant).
    await db
      .delete(schema.clientLogos)
      .where(and(eq(schema.clientLogos.clientId, client.id), eq(schema.clientLogos.variant, variant)));
    await db.insert(schema.clientLogos).values({
      id: randomUUID(),
      clientId: client.id,
      variant,
      data: buffer,
      mime,
      size: buffer.length,
    });
    const url = `/api/logos/client/${client.id}?v=${variant}&t=${Date.now()}`;
    // Update the matching clients column too.
    const colUpdate = variant === "light" ? { logoUrlLight: url } : { logoUrl: url };
    await db.update(schema.clients).set(colUpdate).where(eq(schema.clients.id, client.id));

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    log.error("Logo upload failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
