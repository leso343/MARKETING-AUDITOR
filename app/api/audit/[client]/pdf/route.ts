/**
 * On-demand PDF export for /audit/[client].
 *
 * Renders the live dashboard server-side via Puppeteer, capturing the
 * fully-hydrated React tree with charts and the print-mode CSS applied.
 *
 * Environment handling:
 *   - Development: dynamically imports the full `puppeteer` package so
 *     Lester gets a one-step `npm i -D puppeteer` and an out-of-the-box
 *     Chromium. Falls back to `PUPPETEER_EXECUTABLE_PATH` if set.
 *   - Production (Vercel, etc.): uses `puppeteer-core` + the slim
 *     `@sparticuz/chromium-min` build (~50 MB) instead of bundling all
 *     of Chromium. This is the configuration that fits inside the
 *     Vercel function size limit.
 *
 * ─── Why the old build returned `pdf.json` ─────────────────────────────────
 * `@sparticuz/chromium-min` ships the *driver code only* — the actual
 * Chromium binary must be downloaded from a remote URL at runtime. The
 * previous version of this route passed `process.env.CHROMIUM_REMOTE_URL`
 * straight through to `chromium.executablePath(...)`. When that env var
 * was unset on Vercel (it always is, unless someone configures it), the
 * helper threw inside `launchBrowser`, the catch returned a JSON 500, and
 * the browser's `<a download>` saved that JSON payload as `pdf.json`
 * because its Content-Type was `application/json`.
 *
 * Fix: hard-code a sensible default URL pointing at the matching
 * `chromium-v148.0.0-pack.x64.tar` on the upstream GitHub release. The
 * env var still wins when set, so Lester can swap in a self-hosted
 * mirror later without code changes. Also return an HTML error page
 * instead of JSON on failure, so even a future regression won't masquerade
 * as a successful download.
 *
 * The dashboard recognises the `?print=true` query string and hides
 * sidebars, controls, and live UI affordances. See AuditDashboard.tsx.
 */
import { NextRequest } from "next/server";

export const runtime = "nodejs";
// PDF rendering is expensive — never cache.
export const dynamic = "force-dynamic";
// Cap at 60s on serverless; local dev ignores this.
export const maxDuration = 60;

/**
 * Default pack URL for the Chromium binary that pairs with
 * `@sparticuz/chromium-min@^148.0.0` (the version pinned in package.json).
 *
 * If you bump that dependency, bump this URL too — the pack tarball must
 * match the chromium-min version exactly or Puppeteer will fail to launch
 * with a protocol mismatch. The canonical assets live at
 * https://github.com/Sparticuz/chromium/releases.
 *
 * Set CHROMIUM_REMOTE_URL in Vercel env vars to override (useful if you
 * mirror the tarball on your own CDN to avoid GitHub release rate limits).
 */
const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

// puppeteer-core ships generic types we can reuse for either backend.
type LaunchResult = { close: () => Promise<void>; newPage: () => Promise<any> };

async function launchBrowser(): Promise<LaunchResult> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Try full puppeteer first (bundled Chromium); fall back to
    // puppeteer-core + PUPPETEER_EXECUTABLE_PATH for environments
    // where bundled Chromium can't be downloaded.
    try {
      // `puppeteer` is an optional dev dependency — only required for local
      // PDF export. We use a typed dynamic import; @ts-expect-error keeps the
      // build green even when it isn't installed.
      // @ts-expect-error optional dev dependency, see comment above
      const mod = (await import("puppeteer")) as unknown as {
        default: { launch: (opts: object) => Promise<LaunchResult> };
      };
      return await mod.default.launch({ headless: true });
    } catch {
      const exec = process.env.PUPPETEER_EXECUTABLE_PATH;
      if (!exec) {
        throw new Error(
          "Dev PDF export needs either `npm install -D puppeteer` or " +
            "PUPPETEER_EXECUTABLE_PATH=/path/to/chrome in your env.",
        );
      }
      const puppeteer = (await import("puppeteer-core")) as unknown as {
        default: { launch: (opts: object) => Promise<LaunchResult> };
      };
      return await puppeteer.default.launch({ executablePath: exec, headless: true });
    }
  }

  // Production: serverless-friendly slim Chromium.
  const puppeteer = (await import("puppeteer-core")) as unknown as {
    default: { launch: (opts: object) => Promise<LaunchResult> };
  };
  const chromium = (await import("@sparticuz/chromium-min")) as unknown as {
    default: {
      args: string[];
      executablePath: (url?: string) => Promise<string>;
      headless: boolean | "shell" | "new";
    };
  };
  // Always pass a URL — chromium-min has no bundled binary, so calling
  // executablePath() with undefined throws. Env var wins; fall back to the
  // pinned upstream pack tarball.
  const packUrl = process.env.CHROMIUM_REMOTE_URL || DEFAULT_CHROMIUM_PACK_URL;
  return await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(packUrl),
    // chromium-min v137+ no longer ships an opinionated `headless` value;
    // it's nullable. Coerce to puppeteer-core's "shell" string default.
    headless: chromium.default.headless ?? "shell",
  });
}

function originFromRequest(req: NextRequest): string {
  // Honour explicit overrides first — useful in container/lambda envs
  // where the public origin differs from `req.nextUrl`.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Reconstruct from headers, with localhost as the dev default.
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function isoDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Render an HTML error page (not JSON). The download anchor on the
 * dashboard saves whatever the server returns; an HTML body with
 * `Content-Type: text/html` will at worst land on disk as `pdf.html`
 * with a readable explanation rather than a mysterious `pdf.json` blob
 * the user can't open. Even better, browsers usually display an HTML
 * response inline instead of forcing the download.
 */
function htmlError(status: number, message: string, detail?: string): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PDF export failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; color: #1a1a1a;
           line-height: 1.5; }
    h1 { color: #c1121f; font-size: 1.5rem; margin-bottom: 1rem; }
    code { background: #f3f3f3; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f3f3f3; padding: 1rem; border-radius: 4px; overflow-x: auto;
          font-size: 0.85em; white-space: pre-wrap; word-break: break-word; }
    .hint { color: #555; font-size: 0.95em; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>PDF export failed</h1>
  <p>${escapeHtml(message)}</p>
  ${detail ? `<pre>${escapeHtml(detail)}</pre>` : ""}
  <p class="hint">
    The dashboard is fine — only the server-side PDF render failed.
    Try refreshing in a minute (cold-start Chromium downloads can time out the first time),
    or use your browser's built-in <strong>Print → Save as PDF</strong> on the dashboard page.
  </p>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ client: string }> },
): Promise<Response> {
  const { client } = await context.params;
  if (!client || !/^[a-z0-9-]+$/i.test(client)) {
    return htmlError(400, "Invalid client slug.");
  }

  const origin = originFromRequest(req);
  // Preserve the same query string the page expects (industry / cpl / ctr /
  // days overrides) so the PDF reflects the user's current view.
  const incoming = req.nextUrl.searchParams;
  const target = new URL(`/audit/${encodeURIComponent(client)}`, origin);
  for (const [k, v] of incoming.entries()) {
    if (k === "print") continue; // we set this explicitly
    target.searchParams.set(k, v);
  }
  target.searchParams.set("print", "true");

  let browser: LaunchResult | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // chromium-min v137+ requires the caller to set the viewport explicitly.
    await page.setViewport({
      width: 1240,
      height: 1600,
      deviceScaleFactor: 2,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });
    await page.emulateMediaType("screen");

    await page.goto(target.toString(), {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });
    // Charts (recharts) and any deferred client work need a beat.
    await new Promise((r) => setTimeout(r, 2000));

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
      preferCSSPageSize: false,
    });

    const filename = `audit-${client}-${isoDate()}.pdf`;
    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[pdf-export]", message);
    return htmlError(500, "Server-side PDF generation failed.", message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* swallow — we already have the bytes */
      }
    }
  }
}
