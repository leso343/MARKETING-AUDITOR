/**
 * Tier 4 — Stripe client wrapper.
 *
 * ─── Deploy-safe guard ─────────────────────────────────────────────────────
 * When STRIPE_SECRET_KEY is unset we DO NOT instantiate the Stripe client
 * (its constructor throws on missing key). Instead we export:
 *   - stripe: null
 *   - stripeEnabled: false
 *   - stripeNotConfiguredResponse(): NextResponse with a 503 + clear message
 *
 * Routes must check `stripeEnabled` and return `stripeNotConfiguredResponse()`
 * if false. This keeps the build green and routes friendly on Vercel when
 * Lester hasn't pasted the keys yet.
 */
import Stripe from "stripe";
import { NextResponse } from "next/server";

const secret = process.env.STRIPE_SECRET_KEY;

let real: Stripe | null = null;
if (secret) {
  try {
    // Let the SDK pick the API version that matches the installed package.
    // Pinning is nicer in theory, but the apiVersion literal type changes on
    // every SDK release and would break `npm install stripe@latest` runs.
    real = new Stripe(secret);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[lib/stripe] Stripe init failed — billing disabled.", err);
  }
}

/** Concrete Stripe client (or null when STRIPE_SECRET_KEY is unset). */
export const stripe: Stripe | null = real;

/** True when STRIPE_SECRET_KEY is set AND the client constructed cleanly. */
export const stripeEnabled: boolean = real !== null;

/** Standard 503 response when Stripe isn't configured. */
export function stripeNotConfiguredResponse() {
  return NextResponse.json(
    { error: "Stripe not configured — set STRIPE_SECRET_KEY" },
    { status: 503 },
  );
}

/** Public app URL. Falls back to localhost for dev. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

/** Resolve tier + billing period → Stripe price ID. Returns null for unknown / unset. */
export function priceIdForTier(tier: string, period: "monthly" | "annual" = "monthly"): string | null {
  if (tier === "pro") {
    return period === "annual"
      ? (process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID ?? null)
      : (process.env.STRIPE_PRO_PRICE_ID ?? null);
  }
  if (tier === "agency") {
    return period === "annual"
      ? (process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID ?? process.env.STRIPE_AGENCY_PRICE_ID ?? null)
      : (process.env.STRIPE_AGENCY_PRICE_ID ?? null);
  }
  return null;
}
