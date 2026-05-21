import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Engine modules rely on Node built-ins (`fs`, `path`) — they MUST stay on
  // the server. Listing papaparse here keeps Next from trying to bundle it for
  // the client. The engine's `analyses/` files import nothing Node-specific
  // and may also be safely tree-shaken into the client if needed.
  //
  // puppeteer-core + @sparticuz/chromium-min are listed defensively so that
  // when the Tier 1 PDF route lands on top of this branch, Next doesn't try
  // to bundle them for the client (they only run server-side from the PDF
  // route). bcryptjs is server-only (auth). prisma client lives on the server.
  serverExternalPackages: [
    "papaparse",
    "puppeteer-core",
    "@sparticuz/chromium-min",
    "bcryptjs",
    "@prisma/client",
    "prisma",
  ],
  // Include CSV data files in the serverless function bundle so they're
  // accessible via fs at runtime on Vercel (output file tracing won't pick
  // them up automatically because they're read by dynamic path).
  outputFileTracingIncludes: {
    "/audit/[client]": ["./public/csvs/**/*", "./data/csvs/**/*"],
  },
};

export default nextConfig;
