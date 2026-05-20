import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Engine modules rely on Node built-ins (`fs`, `path`) — they MUST stay on
  // the server. Listing papaparse here keeps Next from trying to bundle it for
  // the client. The engine's `analyses/` files import nothing Node-specific
  // and may also be safely tree-shaken into the client if needed.
  serverExternalPackages: ["papaparse", "puppeteer"],
  // Include CSV data files in the serverless function bundle so they're
  // accessible via fs at runtime on Vercel (output file tracing won't pick
  // them up automatically because they're read by dynamic path).
  outputFileTracingIncludes: {
    "/audit/[client]": ["./public/csvs/**/*"],
  },
};

export default nextConfig;
