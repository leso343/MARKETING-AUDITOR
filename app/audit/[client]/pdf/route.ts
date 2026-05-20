/**
 * GET /audit/[client]/pdf
 *
 * Launches a headless Chromium via puppeteer, navigates back to the dashboard
 * page for this client, waits for it to settle, and prints it to PDF.
 *
 * The browser running puppeteer makes a normal HTTP request to the same
 * Next.js server, so this works in `next dev` and `next start` without
 * any extra plumbing. For Vercel/serverless deploys you'd swap puppeteer
 * for puppeteer-core + @sparticuz/chromium — out of scope here.
 */
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ client: string }> },
) {
  const { client } = await ctx.params;

  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  // Preserve sliders/industry/days so the PDF reflects the live preview state.
  const passthrough = new URLSearchParams();
  for (const k of ["cpl", "ctr", "industry", "days"]) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) passthrough.set(k, v);
  }
  passthrough.set("print", "1");
  const target = `${origin}/audit/${client}?${passthrough.toString()}`;

  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2000, deviceScaleFactor: 2 });
    await page.emulateMediaType("screen");

    await page.goto(target, { waitUntil: "networkidle0", timeout: 45000 });

    // Dashboard wraps content in `h-screen overflow-hidden` with a nested
    // `overflow-y-auto main` — perfect for the live UI, fatal for print.
    // Flatten every scroll container so puppeteer captures the full layout
    // and paginates naturally.
    await page.addStyleTag({
      content: `
        html, body { height: auto !important; overflow: visible !important; }
        .h-screen { height: auto !important; min-height: 0 !important; }
        [class*="overflow-"] { overflow: visible !important; }
        main, aside { height: auto !important; max-height: none !important; overflow: visible !important; }
        /* Sidebar + sticky header look broken in print; hide them */
        aside, header.sticky { display: none !important; }
        /* The header's right-side controls are noisy in a static export */
        button { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `,
    });

    // Recharts and the canvas map render after hydration; give them a beat.
    await new Promise((r) => setTimeout(r, 1500));

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.4in", bottom: "0.5in", left: "0.4in" },
    });

    const filename = `${client}-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
