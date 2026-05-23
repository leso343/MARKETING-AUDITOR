/**
 * POST /api/billing/checkout — create a Stripe Checkout session.
 *
 * Body: { tier: "pro" | "agency" }   (legacy alias `plan` is also accepted)
 *
 * Returns: { url: string }  → the client redirects to Stripe.
 *
 * Flow:
 *   1. Verify session (auth())
 *   2. Resolve tier → price ID via env (STRIPE_PRO_PRICE_ID / STRIPE_AGENCY_PRICE_ID)
 *   3. Upsert a Subscription row in 'incomplete' state so we have something
 *      to correlate the webhook to (looked up by agencyId / client_reference_id).
 *   4. Stripe Checkout session with mode=subscription, success/cancel URLs,
 *      customer_email from session.user, client_reference_id=agencyId.
 *   5. Return { url }.
 *
 * ─── Deploy-safe guard ─────────────────────────────────────────────────────
 *   - STRIPE_SECRET_KEY unset → 503 "Stripe not configured — set STRIPE_SECRET_KEY"
 *   - AUTH_SECRET or DATABASE_URL unset → 503 (multi-tenant required)
 *   - Missing price ID → 503 with a clear message naming the env var.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";
import {
  stripe,
  stripeEnabled,
  stripeNotConfiguredResponse,
  appUrl,
  priceIdForTier,
} from "@/lib/stripe";

const ALLOWED_TIERS = new Set(["pro", "agency"]);

export async function POST(req: Request) {
  if (!stripeEnabled || !stripe) {
    return stripeNotConfiguredResponse();
  }
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      {
        error:
          "Billing is disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized — sign in first." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { tier?: string; plan?: string; period?: string };
  // Accept `tier` (new spec) or `plan` (legacy from existing PricingCard).
  const tier = (body.tier ?? body.plan ?? "").toLowerCase();
  if (!ALLOWED_TIERS.has(tier)) {
    return NextResponse.json(
      { error: `Unknown tier "${tier}". Expected "pro" or "agency".` },
      { status: 400 },
    );
  }

  const period: "monthly" | "annual" = body.period === "annual" ? "annual" : "monthly";
  const priceId = priceIdForTier(tier, period);
  if (!priceId) {
    const envName = tier === "pro" ? "STRIPE_PRO_PRICE_ID" : "STRIPE_AGENCY_PRICE_ID";
    return NextResponse.json(
      { error: `Stripe not configured — set ${envName}` },
      { status: 503 },
    );
  }

  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json(
      {
        error:
          "Your user isn't attached to an agency. Contact support to provision one before subscribing.",
      },
      { status: 400 },
    );
  }

  // Pre-create / update the local Subscription row so the webhook handler
  // has a stable target to correlate against (looked up by agencyId).
  const existing = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.agencyId, agencyId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.subscriptions)
      .set({
        plan: tier as "pro" | "agency",
        status: "incomplete",
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.id, existing[0].id));
  } else {
    await db.insert(schema.subscriptions).values({
      id: randomUUID(),
      agencyId,
      plan: tier as "pro" | "agency",
      status: "incomplete",
    });
  }

  // Create the Checkout session.
  const base = appUrl();
  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      customer_email: session.user.email ?? undefined,
      client_reference_id: agencyId,
      metadata: {
        agencyId,
        tier,
      },
      subscription_data: {
        metadata: { agencyId, tier },
      },
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message:
            "By subscribing you agree that all sales are final and no refunds will be issued. You may cancel anytime.",
        },
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/billing/checkout] Stripe error:", err);
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!checkoutSession.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: checkoutSession.url });
}
