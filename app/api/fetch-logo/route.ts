/**
 * POST /api/fetch-logo — auto-fetch a logo from a client's website URL.
 *
 * Re-audited (Phase 2) and rewritten:
 *
 *   - NEW-C-11 (SSRF): validates the URL with `validateOutboundUrl()`
 *     before BOTH the page fetch and the extracted-logo fetch.
 *     Redirects are handled manually so each hop is re-validated. No
 *     more reaching 169.254.169.254 / 10.x / localhost / file://.
 *   - NEW-C-12 (no agency scope): the caller's `clientSlug` is now
 *     resolved against the session's agency via
 *     getVisibleClientBySlug(); the user-supplied `clientId` is
 *     ignored — we use the looked-up client's id.
 *   - NEW-C-13: bytes are stored in client_logos (blob) instead of
 *     `public/csvs/...` (Vercel FS is ephemeral). The URL returned
 *     points at /api/logos/client/[clientId].
 *   - M-14 / SVG: image/svg+xml is dropped from the type allowlist.
 *   - H-5: slug regex is lowercase + strict.
 *   - Content-Length pre-check before download (don't pull 100MB+
 *     before the size cap fires).
 *
 * Body: { url: string, clientSlug: string }
 *
 * Returns:
 *   { ok: true, logoUrl, logoUrlLight, sourceUrl }
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getVisibleClientBySlug } from "@/lib/access";
import { safeSlug } from "@/lib/billing-access";
import { validateOutboundUrl, isPrivateAddress } from "@/lib/url-safety";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB (matches /api/upload-logo)
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;
const USER_AGENT = "BlankPageAuditsBot/1.0 (+https://blankpageaudits.app)";

const ALLOWED_LOGO_MIME: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
};

/** Extract the best logo URL from raw HTML. */
function extractLogoUrl(html: string, baseUrl: string): string | null {
  const candidates: { url: string; priority: number }[] = [];

  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) candidates.push({ url: ogMatch[1], priority: 3 });

  const imgRegex = /<img[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
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

  const appleIcon =
    html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleIcon?.[1]) candidates.push({ url: appleIcon[1], priority: 2 });

  const iconRegex = /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  let iconMatch: RegExpExecArray | null;
  while ((iconMatch = iconRegex.exec(html)) !== null) {
    const tag = iconMatch[0];
    const href = iconMatch[1];
    const sizeMatch = tag.match(/sizes=["'](\d+)x\d+["']/);
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 16;
    candidates.push({ url: href, priority: size >= 64 ? 2 : 1 });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority);

  const best = candidates[0].url;
  try {
    return new URL(best, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL safely: validate before every hop, follow up to N
 * redirects manually, abort on private-IP hosts at any step.
 */
async function safeFetch(rawUrl: string, accept: string): Promise<{ res: Response; finalUrl: string } | null> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const v = await validateOutboundUrl(currentUrl);
    if (!v.ok) {
      log.warn("safeFetch blocked URL", { url: currentUrl, reason: v.reason });
      return null;
    }
    const res = await fetch(v.url.href, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      currentUrl = new URL(location, v.url.href).href;
      // Loop continues — next hop re-validated.
      continue;
    }
    return { res, finalUrl: v.url.href };
  }
  return null;
}

function inferMime(contentType: string | null): string | null {
  if (!contentType) return null;
  const norm = contentType.split(";")[0].trim().toLowerCase();
  return ALLOWED_LOGO_MIME[norm] ?? null;
}

export async function POST(req: Request) {
  if (!dbAvailable) {
    return NextResponse.json(
      { error: "Database unavailable — fetch-logo requires DATABASE_URL." },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit: 10 / min / IP. Outbound fetches cost something.
  const rl = rateLimit(`fetch-logo:${getClientIp(req)}`, { max: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { url?: unknown; clientSlug?: unknown };
  const rawUrl = String(body.url ?? "").trim();
  const slug = safeSlug(body.clientSlug);
  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Invalid clientSlug" }, { status: 400 });

  // NEW-C-12 fix: resolve the slug against the caller's agency.
  const client = await getVisibleClientBySlug(slug);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Normalize bare-host input ("example.com") to https://.
  const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  // NEW-C-11 fix: validate before fetching the page.
  const pageFetch = await safeFetch(normalized, "text/html,application/xhtml+xml");
  if (!pageFetch || !pageFetch.res.ok) {
    return NextResponse.json(
      { error: "Could not fetch the page — check the URL and try again." },
      { status: 400 },
    );
  }

  // Cap HTML size to avoid OOM on giant pages.
  const HTML_MAX = 2 * 1024 * 1024;
  const htmlContentLength = Number(pageFetch.res.headers.get("content-length") ?? "0");
  if (htmlContentLength && htmlContentLength > HTML_MAX) {
    return NextResponse.json({ error: "Page too large to scan." }, { status: 400 });
  }
  const html = await pageFetch.res.text();
  if (html.length > HTML_MAX) {
    return NextResponse.json({ error: "Page too large to scan." }, { status: 400 });
  }

  const extractedLogoUrl = extractLogoUrl(html, pageFetch.finalUrl);
  if (!extractedLogoUrl) {
    return NextResponse.json(
      { error: "No logo found on that page. Try uploading manually." },
      { status: 404 },
    );
  }

  // NEW-C-11 fix: re-validate the extracted logo URL with the same
  // host/redirect guards before the second fetch.
  const logoFetch = await safeFetch(extractedLogoUrl, "image/*");
  if (!logoFetch || !logoFetch.res.ok) {
    return NextResponse.json(
      { error: "Could not download the discovered logo." },
      { status: 400 },
    );
  }
  // Pre-check Content-Length before pulling bytes.
  const cl = Number(logoFetch.res.headers.get("content-length") ?? "0");
  if (cl && cl > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo file too large (>2 MB)." }, { status: 400 });
  }
  // M-14 fix: drop SVG.
  const mime = inferMime(logoFetch.res.headers.get("content-type"));
  if (!mime) {
    return NextResponse.json(
      { error: "Discovered logo is not a supported image type (PNG/JPEG/WEBP)." },
      { status: 400 },
    );
  }
  const buffer = Buffer.from(await logoFetch.res.arrayBuffer());
  if (buffer.length > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo file too large (>2 MB)." }, { status: 400 });
  }

  // NEW-C-13 fix: store in DB (client_logos), not on disk. Persist
  // the SAME bytes as both dark + light variants — the auto-fetch
  // path can't realistically discriminate, and the user can later
  // upload a variant via /api/upload-logo.
  try {
    await db
      .delete(schema.clientLogos)
      .where(and(eq(schema.clientLogos.clientId, client.id), eq(schema.clientLogos.variant, "dark")));
    await db.insert(schema.clientLogos).values({
      id: randomUUID(),
      clientId: client.id,
      variant: "dark",
      data: buffer,
      mime,
      size: buffer.length,
    });
  } catch (err) {
    log.error("fetch-logo: client_logos insert failed", err);
    return NextResponse.json({ error: "Could not save logo." }, { status: 500 });
  }
  const logoUrl = `/api/logos/client/${client.id}?v=dark&t=${Date.now()}`;
  const logoUrlLight = logoUrl;

  // Best-effort: also persist on the clients row so existing renderers find it.
  try {
    // Only store the website if it passed validation (it did, via safeFetch).
    await db
      .update(schema.clients)
      .set({
        logoUrl,
        logoUrlLight,
        websiteUrl: pageFetch.finalUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.clients.id, client.id));
  } catch (err) {
    log.warn("fetch-logo: updating clients row failed", { error: String(err) });
  }

  return NextResponse.json({
    ok: true,
    logoUrl,
    logoUrlLight,
    sourceUrl: pageFetch.finalUrl,
  });
}

// Silence unused import — kept for future host overrides
void isPrivateAddress;
