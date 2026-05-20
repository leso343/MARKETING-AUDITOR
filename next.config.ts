import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Engine modules rely on Node built-ins (`fs`, `path`) — they MUST stay on
  // the server. Listing papaparse here keeps Next from trying to bundle it
  // for the client. Also list the PDF-export packages (puppeteer-core,
  // @sparticuz/chromium-min) so the slim Chromium binary isn't traced into
  // the client bundle. `puppeteer` is dev-only and optional; the api route
  // imports it dynamically so a missing module is OK at runtime.
  serverExternalPackages: [
    "papaparse",
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium-min",
  ],
  // Include CSV data files in the serverless function bundle so they're
  // accessible via fs at runtime on Vercel (output file tracing won't pick
  // them up automatically because they're read by dynamic path).
  outputFileTracingIncludes: {
    "/audit/[client]": ["./public/csvs/**/*"],
  },
  // Webpack: mark `puppeteer` as an optional external. This silences the
  // build-time "Can't resolve 'puppeteer'" warning when Lester hasn't
  // installed the optional dev dependency. Falls back to puppeteer-core +
  // @sparticuz/chromium-min in production.
  webpack(config, { isServer }) {
    if (isServer) {
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];
      config.externals = [
        ...existing,
        ({ request }: { request?: string }, callback: (err?: unknown, result?: string) => void) => {
          if (request === "puppeteer") {
            // Tell webpack to leave the import alone — Node resolution at
            // runtime decides if the module exists; the route catches the
            // ENOENT and falls back to puppeteer-core.
            return callback(null, "commonjs " + request);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
