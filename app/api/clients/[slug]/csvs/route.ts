/**
 * POST /api/clients/[slug]/csvs — upload Meta Ads CSVs for a client.
 *
 * Accepts multipart/form-data with one or more `file` fields. The
 * filename is preserved so the parser's classify() can identify
 * which export it is (campaigns / ads / breakdowns / ...).
 *
 * Each upload upserts on (clientId, filename) so re-uploading replaces
 * the previous version.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * Returns 503 when AUTH_SECRET / DATABASE_URL are unset (multi-tenant
 * features require both).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getVisibleClientBySlug, tryGetUser } from "@/lib/access";
import { authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

function gatedOff() {
  return NextResponse.json(
    {
      error:
        "CSV uploads are disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL.",
    },
    { status: 503 },
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

  // Rate limit: 20 uploads per minute per IP
  const rl = rateLimit(`upload:${getClientIp(req)}`, { max: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many uploads — please wait a moment." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  try {
    const { slug } = await params;
    const client = await getVisibleClientBySlug(slug);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const contentType = req.headers.get("content-type") ?? "";
    const results: { filename: string; bytes: number; status: "saved" | "error"; error?: string }[] = [];

    if (contentType.includes("application/json")) {
      // JSON upload: { filename, content } — used by onboarding wizard
      const body = await req.json();
      const filename = String(body.filename ?? "").trim();
      const content = String(body.content ?? "");
      if (!filename || !filename.toLowerCase().endsWith(".csv")) {
        return NextResponse.json({ error: "Filename must end in .csv" }, { status: 400 });
      }
      if (content.length > MAX_BYTES) {
        return NextResponse.json({ error: "Content exceeds 10 MB" }, { status: 400 });
      }
      await db.delete(schema.csvFiles).where(
        and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, filename)),
      );
      await db.insert(schema.csvFiles).values({
        id: randomUUID(),
        clientId: client.id,
        filename,
        content,
      });
      results.push({ filename, bytes: content.length, status: "saved" });
    } else {
      // Multipart upload: one or more `file` fields
      const form = await req.formData();
      const files = form.getAll("file") as File[];
      if (files.length === 0) {
        return NextResponse.json({ error: "No files provided (use field name 'file')" }, { status: 400 });
      }

      for (const f of files) {
        if (!(f instanceof File)) continue;
        if (!f.name.toLowerCase().endsWith(".csv")) {
          results.push({ filename: f.name, bytes: 0, status: "error", error: "Not a .csv file" });
          continue;
        }
        if (f.size > MAX_BYTES) {
          results.push({ filename: f.name, bytes: f.size, status: "error", error: "Exceeds 10 MB" });
          continue;
        }

        const text = await f.text();

        // Upsert: delete existing rows for (clientId, filename) then insert.
        await db.delete(schema.csvFiles).where(
          and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, f.name)),
        );
        await db.insert(schema.csvFiles).values({
          id: randomUUID(),
          clientId: client.id,
          filename: f.name,
          content: text,
        });

        results.push({ filename: f.name, bytes: f.size, status: "saved" });
      }
    }

    // Notify user that data is ready for audit
    const savedCount = results.filter((r) => r.status === "saved").length;
    if (savedCount > 0) {
      const user = await tryGetUser();
      if (user) {
        await notify(user.id, {
          type: "audit_complete",
          title: "Audit data uploaded",
          message: `${savedCount} CSV${savedCount !== 1 ? "s" : ""} uploaded for ${client.name}. Your forensic audit is ready to view.`,
          actionUrl: `/audit/${slug}`,
        });
      }
    }

    return NextResponse.json({ clientSlug: slug, results });
  } catch (error) {
    log.error("POST /api/clients/[slug]/csvs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

  try {
    const { slug } = await params;
    const client = await getVisibleClientBySlug(slug);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    if (!filename) return NextResponse.json({ error: "Missing ?filename=" }, { status: 400 });

    await db.delete(schema.csvFiles).where(
      and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, filename)),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error("DELETE /api/clients/[slug]/csvs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

  try {
    const { slug } = await params;
    const client = await getVisibleClientBySlug(slug);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const files = await db.select({
      id: schema.csvFiles.id,
      filename: schema.csvFiles.filename,
      uploadedAt: schema.csvFiles.uploadedAt,
    }).from(schema.csvFiles).where(eq(schema.csvFiles.clientId, client.id));

    return NextResponse.json({ clientSlug: slug, files });
  } catch (error) {
    log.error("GET /api/clients/[slug]/csvs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
