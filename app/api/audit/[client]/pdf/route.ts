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
 * The dashboard recognises the `?print=true` query string and hides
 * sidebars, controls, and live UI affordances. See AuditDashboard.tsx.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// PDF rendering is expensive — never cache.
export const dynamic = "force-dynamic";
// Cap at 60s on serverless; local dev ignores this.
export const maxDuration = 60;

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
      headless: boolean | "new";
    };
  };
  return await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(
      process.env.CHROMIUM_REMOTE_URL,
    ),
    headless: chromium.default.headless,
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ client: string }> },
): Promise<Response> {
  const { client } = await context.params;
  if (!client || !/^[a-z0-9-]+$/i.test(client)) {
    return NextResponse.json({ error: "Invalid client slug" }, { status: 400 });
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

    await page.setViewport({ width: 1240, height: 1600, deviceScaleFactor: 2 });
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
    console.error("[pdf-export]", message);
    return NextResponse.json(
      { error: "PDF generation failed", detail: message },
      { status: 500 },
    );
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
