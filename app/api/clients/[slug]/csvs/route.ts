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
import { getVisibleClientBySlug } from "@/lib/access";
import { authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";

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

  const { slug } = await params;
  const client = await getVisibleClientBySlug(slug);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("file") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided (use field name 'file')" }, { status: 400 });
  }

  const results: { filename: string; bytes: number; status: "saved" | "error"; error?: string }[] = [];

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

  return NextResponse.json({ clientSlug: slug, results });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

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
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

  const { slug } = await params;
  const client = await getVisibleClientBySlug(slug);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const files = await db.select({
    id: schema.csvFiles.id,
    filename: schema.csvFiles.filename,
    uploadedAt: schema.csvFiles.uploadedAt,
  }).from(schema.csvFiles).where(eq(schema.csvFiles.clientId, client.id));

  return NextResponse.json({ clientSlug: slug, files });
}
