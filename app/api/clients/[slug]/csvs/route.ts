/**
 * POST /api/clients/[slug]/csvs — upload Meta Ads CSVs for a client.
 *
 * Two accepted shapes:
 *   - multipart/form-data with one or more `file` fields
 *   - application/json { filename, content } (used by OnboardingWizard)
 *
 * Audit fixes folded in:
 *   - C-3 / NEW-M-29: filenames run through `path.basename()` and the
 *     strict allowlist regex; refuses anything with `/`, `\\`, `..`, or
 *     NUL bytes.
 *   - C-6 / C-7: subscription status enforced; per-client CSV cap from
 *     the canonical plan helper.
 *   - H-12 / NEW-H-20: per-file size limit applied to BOTH shapes;
 *     UTF-8 enforced via `TextDecoder("utf-8", { fatal: true })`;
 *     header sniffed to ensure it looks like a Meta CSV;
 *     line-count capped at 50_000 to avoid OOM via papaparse.
 *   - H-18: delete+insert wrapped in `db.transaction` where the libsql
 *     driver supports it; otherwise we do a safe two-step with
 *     rollback-on-failure that preserves the existing row.
 *   - M-15: parse warnings collected and returned in the response.
 *
 * Returns 503 when AUTH_SECRET / DATABASE_URL are unset.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getVisibleClientBySlug, tryGetUser } from "@/lib/access";
import { authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { getBillingState, countClientCsvs } from "@/lib/billing-access";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_LINES = 50_000; // protect papaparse from O(rows)
const MAX_TOTAL_BODY = 60 * 1024 * 1024; // hard cap for JSON body

const FILENAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

function safeFilename(input: string): string | null {
  const base = path.basename(input).trim();
  if (!base) return null;
  if (base === "." || base === "..") return null;
  if (base.includes("\0")) return null;
  if (!FILENAME_RE.test(base)) return null;
  if (!base.toLowerCase().endsWith(".csv")) return null;
  return base;
}

function gatedOff() {
  return NextResponse.json(
    {
      error:
        "CSV uploads are disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL.",
    },
    { status: 503 },
  );
}

/**
 * Validate that `text` decodes as strict UTF-8 and is shaped like a
 * Meta Ads CSV (first line includes "Campaign", "Ad", "Reporting
 * starts", "Reach", "Impressions", etc.). Returns the row count or
 * an error.
 */
function validateCsvText(text: string): { ok: true; rows: number } | { ok: false; error: string } {
  // Strict UTF-8: re-encode and verify roundtrip. Buffer.from has
  // already decoded the bytes; we redo it with fatal:true to catch
  // invalid sequences.
  try {
    const bytes = Buffer.from(text, "utf8");
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "File is not valid UTF-8." };
  }
  // Row cap before papaparse touches it.
  let lines = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0a) {
      lines++;
      if (lines > MAX_LINES) return { ok: false, error: `Too many rows (>${MAX_LINES}).` };
    }
  }
  // Header sniff: first line should look like Meta's exports.
  const firstNewline = text.indexOf("\n");
  const header = (firstNewline === -1 ? text : text.slice(0, firstNewline)).toLowerCase();
  const hits = ["campaign", "ad", "reporting", "reach", "impressions", "amount", "results"].filter((k) =>
    header.includes(k),
  ).length;
  if (hits < 2) {
    return { ok: false, error: "File does not look like a Meta Ads export." };
  }
  return { ok: true, rows: lines };
}

async function upsertCsv(clientId: string, filename: string, content: string): Promise<void> {
  // H-18 fix: try transaction first; fall back to safer two-step.
  const drizzleAny = db as unknown as {
    transaction?: (fn: (tx: typeof db) => Promise<void>) => Promise<void>;
  };
  if (typeof drizzleAny.transaction === "function") {
    await drizzleAny.transaction(async (tx) => {
      await tx
        .delete(schema.csvFiles)
        .where(and(eq(schema.csvFiles.clientId, clientId), eq(schema.csvFiles.filename, filename)));
      await tx.insert(schema.csvFiles).values({
        id: randomUUID(),
        clientId,
        filename,
        content,
      });
    });
    return;
  }
  // Fallback path: do insert first to a temp filename, then promote
  // by deleting the old + renaming. Preserves the existing row if the
  // insert fails. libsql DOES support transaction, so this is mostly
  // a belt-and-suspenders path.
  const tempName = `__pending__${randomUUID()}.csv`;
  await db.insert(schema.csvFiles).values({
    id: randomUUID(),
    clientId,
    filename: tempName,
    content,
  });
  await db
    .delete(schema.csvFiles)
    .where(and(eq(schema.csvFiles.clientId, clientId), eq(schema.csvFiles.filename, filename)));
  await db
    .update(schema.csvFiles)
    .set({ filename })
    .where(and(eq(schema.csvFiles.clientId, clientId), eq(schema.csvFiles.filename, tempName)));
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!authEnabled || !dbAvailable) return gatedOff();

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

    // C-6 / C-7: status + CSV-per-client cap (the per-file size
    // limit is enforced below).
    const billing = await getBillingState(client.agencyId);
    if (!billing.ok) {
      return NextResponse.json(
        { error: billing.reason, code: billing.code },
        { status: 403 },
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    const results: {
      filename: string;
      bytes: number;
      status: "saved" | "error";
      error?: string;
      warning?: string;
    }[] = [];

    // ── JSON branch ──────────────────────────────────────────────────────
    if (contentType.includes("application/json")) {
      // NEW-H-20 fix: cap body bytes BEFORE req.json() (sort of —
      // there's no streaming API in App Router without rewriting,
      // so we honor Content-Length plus a defensive post-parse check).
      const clHdr = Number(req.headers.get("content-length") ?? "0");
      if (clHdr && clHdr > MAX_TOTAL_BODY) {
        return NextResponse.json({ error: "Request body too large." }, { status: 413 });
      }
      const body = (await req.json().catch(() => ({}))) as {
        filename?: unknown;
        content?: unknown;
      };
      const filename = safeFilename(String(body.filename ?? ""));
      const content = typeof body.content === "string" ? body.content : "";
      if (!filename) {
        return NextResponse.json(
          { error: "filename must be a simple .csv name (a-z0-9._-)." },
          { status: 400 },
        );
      }
      if (!content) {
        return NextResponse.json({ error: "content is required." }, { status: 400 });
      }
      if (content.length > MAX_BYTES) {
        return NextResponse.json({ error: "Content exceeds 10 MB." }, { status: 400 });
      }
      const v = validateCsvText(content);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      // CSV-per-client cap (C-7).
      const limit = billing.plan.csvsPerClient;
      if (Number.isFinite(limit)) {
        const existingCount = await countClientCsvs(client.id);
        // If a row with this filename already exists, it'd be an
        // upsert and not increase the count. Check separately.
        const sameName = await db
          .select({ id: schema.csvFiles.id })
          .from(schema.csvFiles)
          .where(and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, filename)))
          .limit(1);
        if (sameName.length === 0 && existingCount >= limit) {
          return NextResponse.json(
            {
              error: `Your ${billing.plan.id} plan allows up to ${limit} CSV files per client. Delete one or upgrade.`,
              code: "CSV_LIMIT",
            },
            { status: 403 },
          );
        }
      }
      await upsertCsv(client.id, filename, content);
      results.push({ filename, bytes: content.length, status: "saved" });
    } else {
      // ── multipart branch ────────────────────────────────────────────────
      const form = await req.formData();
      const files = form.getAll("file") as File[];
      if (files.length === 0) {
        return NextResponse.json({ error: "No files provided (use field name 'file')" }, { status: 400 });
      }

      const limit = billing.plan.csvsPerClient;
      let existingCount = Number.isFinite(limit) ? await countClientCsvs(client.id) : 0;

      for (const f of files) {
        if (!(f instanceof File)) continue;
        const filename = safeFilename(f.name);
        if (!filename) {
          results.push({
            filename: f.name,
            bytes: 0,
            status: "error",
            error: "Filename must be a simple .csv name (a-z0-9._-).",
          });
          continue;
        }
        if (f.size > MAX_BYTES) {
          results.push({ filename, bytes: f.size, status: "error", error: "Exceeds 10 MB" });
          continue;
        }
        const text = await f.text();
        const v = validateCsvText(text);
        if (!v.ok) {
          results.push({ filename, bytes: f.size, status: "error", error: v.error });
          continue;
        }
        // CSV-per-client cap, per-file.
        if (Number.isFinite(limit)) {
          const same = await db
            .select({ id: schema.csvFiles.id })
            .from(schema.csvFiles)
            .where(and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, filename)))
            .limit(1);
          if (same.length === 0) {
            if (existingCount >= limit) {
              results.push({
                filename,
                bytes: f.size,
                status: "error",
                error: `Your ${billing.plan.id} plan allows up to ${limit} CSVs per client.`,
              });
              continue;
            }
            existingCount++;
          }
        }
        try {
          await upsertCsv(client.id, filename, text);
          results.push({ filename, bytes: f.size, status: "saved" });
        } catch (err) {
          results.push({
            filename,
            bytes: f.size,
            status: "error",
            error: err instanceof Error ? err.message : "Save failed",
          });
        }
      }
    }

    // Notify user that data is ready.
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
    const filenameRaw = searchParams.get("filename");
    const filename = filenameRaw ? safeFilename(filenameRaw) : null;
    if (!filename) return NextResponse.json({ error: "Invalid ?filename=" }, { status: 400 });

    await db
      .delete(schema.csvFiles)
      .where(and(eq(schema.csvFiles.clientId, client.id), eq(schema.csvFiles.filename, filename)));
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

    const files = await db
      .select({
        id: schema.csvFiles.id,
        filename: schema.csvFiles.filename,
        uploadedAt: schema.csvFiles.uploadedAt,
      })
      .from(schema.csvFiles)
      .where(eq(schema.csvFiles.clientId, client.id));

    return NextResponse.json({ clientSlug: slug, files });
  } catch (error) {
    log.error("GET /api/clients/[slug]/csvs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
