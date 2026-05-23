import type { NextConfig } from "next";

/**
 * Security headers — M-8 fix.
 *
 * - X-Frame-Options DENY      : clickjacking
 * - X-Content-Type-Options nosniff : MIME confusion
 * - Referrer-Policy           : limit referrer leakage to third parties
 * - Strict-Transport-Security : force HTTPS for 2y (preload-eligible)
 * - Content-Security-Policy   : keep things tight; allow fonts/leaflet
 *                              CSS, Plausible + GA scripts, Stripe + Meta
 *                              + Resend connections, our own logo blobs.
 *
 * The CSP intentionally allows `'unsafe-inline'` for styles because Tailwind
 * (and dynamically-injected BrandTheme overrides) emit inline <style> tags.
 * Scripts also keep 'unsafe-inline' for Next's framework chunks; tightening
 * to nonces is a follow-up task once we have a Next 15-compatible config.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.stripe.com https://*.facebook.com https://api.resend.com https://*.turso.io https://plausible.io https://www.google-analytics.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "papaparse",
    "bcryptjs",
    "@prisma/client",
    "prisma",
  ],
  outputFileTracingIncludes: {
    "/audit/[client]": ["./public/csvs/**/*", "./data/csvs/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
