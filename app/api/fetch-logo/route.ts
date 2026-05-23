/**
 * POST /api/fetch-logo — auto-fetch a logo from a client's website URL.
 *
 * Scrapes the target page for:
 *   1. Open Graph image (og:image)
 *   2. Logo-related <img> tags (src contains "logo")
 *   3. apple-touch-icon
 *   4. Favicon (link[rel="icon"])
 *
 * Downloads the best match, saves it to public/csvs/<slug>/logo.<ext>,
 * and optionally updates the client's logoUrl in the DB.
 *
 * Body: { url: string, clientSlug: string, clientId?: string }
 */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { auth, authEnabled } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Extract the best logo URL from raw HTML. */
function extractLogoUrl(html: string, baseUrl: string): string | null {
  const candidates: { url: string; priority: number }[] = [];

  // 1. og:image (high priority — usually a clean brand image)
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) {
    candidates.push({ url: ogMatch[1], priority: 3 });
  }

  // 2. <img> tags with "logo" in src, alt, or class (highest priority)
  const imgRegex = /<img[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0].toLowerCase();
    const src = imgMatch[1];
    if (
      tag.includes("logo") ||
      src.toLowerCase().includes("logo") ||
      tag.includes('class="custom-logo') ||
      tag.includes("site-logo") ||
      tag.includes("brand")
    ) {
      candidates.push({ url: src, priority: 5 });
    }
  }

  // Also check for srcset or data-src with logo
  const dataSrcRegex = /<img[^>]*data-src=["']([^"']+logo[^"']*?)["'][^>]*>/gi;
  let dsMatch;
  while ((dsMatch = dataSrcRegex.exec(html)) !== null) {
    candidates.push({ url: dsMatch[1], priority: 4 });
  }

  // 3. apple-touch-icon (good quality, usually 180x180+)
  const appleIcon = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleIcon?.[1]) {
    candidates.push({ url: appleIcon[1], priority: 2 });
  }

  // 4. Large favicon (link[rel="icon"] with sizes)
  const iconRegex = /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  let iconMatch;
  while ((iconMatch = iconRegex.exec(html)) !== null) {
    const tag = iconMatch[0];
    const href = iconMatch[1];
    // Prefer larger icons
    const sizeMatch = tag.match(/sizes=["'](\d+)x\d+["']/);
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 16;
    if (size >= 64) {
      candidates.push({ url: href, priority: 2 });
    } else {
      candidates.push({ url: href, priority: 1 });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Resolve relative URLs
  const best = candidates[0].url;
  try {
    return new URL(best, baseUrl).href;
  } catch {
    return best.startsWith("http") ? best : null;
  }
}

/** Determine file extension from content-type or URL. */
function getExtension(contentType: string | null, url: string): string {
  if (contentType?.includes("svg")) return "svg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  // Fall back to URL
  const urlLower = url.toLowerCase();
  if (urlLower.includes(".svg")) return "svg";
  if (urlLower.includes(".webp")) return "webp";
  if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) return "jpg";
  return "png"; // default
}

export async function POST(req: Request) {
  if (!authEnabled) {
    return NextResponse.json({ error: "Auth required" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = (body?.url ?? "").toString().trim();
  const clientSlug = (body?.clientSlug ?? "").toString().trim();
  const clientId = (body?.clientId ?? "").toString().trim() || null;

  if (!url || !clientSlug) {
    return NextResponse.json({ error: "url and clientSlug are required" }, { status: 400 });
  }

  // Normalize URL
  let targetUrl = url;
  if (!targetUrl.startsWith("http")) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    // Fetch the page HTML
    const pageRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BlankPageAudits/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!pageRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch ${targetUrl} (${pageRes.status})` },
        { status: 400 },
      );
    }

    const html = await pageRes.text();
    const logoUrl = extractLogoUrl(html, targetUrl);

    if (!logoUrl) {
      return NextResponse.json(
        { error: "No logo found on that page. Try uploading manually." },
        { status: 404 },
      );
    }

    // Download the logo
    const logoRes = await fetch(logoUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlankPageAudits/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!logoRes.ok) {
      return NextResponse.json(
        { error: `Could not download logo from ${logoUrl}` },
        { status: 400 },
      );
    }

    const contentType = logoRes.headers.get("content-type");
    const buffer = Buffer.from(await logoRes.arrayBuffer());

    if (buffer.length > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo file too large (>5 MB)" }, { status: 400 });
    }

    const ext = getExtension(contentType, logoUrl);
    const safeSlug = clientSlug.replace(/[^a-z0-9-_]/gi, "-");
    const saveDir = path.join(process.cwd(), "public", "csvs", safeSlug);
    fs.mkdirSync(saveDir, { recursive: true });

    // Delete old logos
    if (fs.existsSync(saveDir)) {
      const existing = fs.readdirSync(saveDir).filter((f) => f.startsWith("logo."));
      for (const old of existing) fs.unlinkSync(path.join(saveDir, old));
    }

    // Save as both logo (dark mode default) and logo-light (light mode)
    const filename = `logo.${ext}`;
    const lightFilename = `logo-light.${ext}`;
    fs.writeFileSync(path.join(saveDir, filename), buffer);
    fs.writeFileSync(path.join(saveDir, lightFilename), buffer);

    const publicUrl = `/csvs/${safeSlug}/${filename}`;
    const publicUrlLight = `/csvs/${safeSlug}/${lightFilename}`;

    // Update DB if clientId provided
    if (clientId && dbAvailable) {
      try {
        await db
          .update(schema.clients)
          .set({
            logoUrl: publicUrl,
            logoUrlLight: publicUrlLight,
            websiteUrl: targetUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.clients.id, clientId));
      } catch (err) {
        log.warn("Failed to update client logoUrl in DB", { error: String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      logoUrl: publicUrl,
      logoUrlLight: publicUrlLight,
      sourceUrl: logoUrl,
    });
  } catch (err) {
    log.error("Logo fetch failed", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch logo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
