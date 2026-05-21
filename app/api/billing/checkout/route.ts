/**
 * POST /api/billing/checkout — stub.
 *
 * Tier 4 will wire this to Stripe Checkout:
 *   1. Verify session.user (auth())
 *   2. Look up / create a Stripe Customer for session.user.agencyId
 *   3. Call stripe.checkout.sessions.create({ price, mode: "subscription", ... })
 *   4. Return { url: session.url } so the client redirects
 *   5. Stripe webhook /api/billing/webhook updates schema.subscriptions
 *
 * For now this just records the intended plan in the agency's Subscription
 * row (creating one if missing) and returns a friendly TODO.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * Returns 503 when DB or auth is unavailable so callers see a clear message
 * instead of a 500.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import { randomUUID } from "node:crypto";

const ALLOWED_PLANS = new Set(["free", "pro", "agency"]);

export async function POST(req: Request) {
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
    return NextResponse.json(
      {
        message:
          "Sign in (or contact your agency admin) and then return to /pricing to subscribe. " +
          "Billing isn't wired up yet — Stripe integration is on the roadmap.",
      },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan ?? "pro";
  if (!ALLOWED_PLANS.has(plan)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json({
      message: "Your user isn't assigned to an agency yet, so we can't attach a subscription. Contact support.",
    }, { status: 400 });
  }

  // Upsert subscription row.
  const existing = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.agencyId, agencyId)).limit(1);
  if (existing[0]) {
    await db.update(schema.subscriptions)
      .set({ plan: plan as "free" | "pro" | "agency", status: "trialing" })
      .where(eq(schema.subscriptions.id, existing[0].id));
  } else {
    await db.insert(schema.subscriptions).values({
      id: randomUUID(),
      agencyId,
      plan: plan as "free" | "pro" | "agency",
      status: "trialing",
    });
  }

  // TODO: integrate Stripe.
  //   const customer = await stripe.customers.create({ email: session.user.email });
  //   const checkoutSession = await stripe.checkout.sessions.create({
  //     customer: customer.id,
  //     mode: "subscription",
  //     line_items: [{ price: PLAN_TO_PRICE_ID[plan], quantity: 1 }],
  //     success_url: `${process.env.NEXTAUTH_URL}/admin/settings?subscribed=1`,
  //     cancel_url:  `${process.env.NEXTAUTH_URL}/pricing?canceled=1`,
  //   });
  //   return NextResponse.json({ url: checkoutSession.url });

  return NextResponse.json({
    message:
      `Selected plan: ${plan}. Stripe checkout isn't wired yet — your selection has been recorded ` +
      `against your agency's Subscription row (status: trialing). The team will be in touch to complete billing.`,
    plan,
    todo: "Stripe checkout integration",
  });
}
