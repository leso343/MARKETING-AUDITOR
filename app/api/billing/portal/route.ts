/**
 * POST /api/billing/portal — create a Stripe Customer Portal session and
 * return { url } so the client can redirect the user to manage their
 * subscription (update card, cancel, switch plan).
 *
 * Looks up the current agency's Subscription row and uses its
 * stripeCustomerId. Requires the row to have been populated by checkout
 * (or by the first customer.subscription.updated webhook).
 *
 * ─── Deploy-safe guard ─────────────────────────────────────────────────────
 *   - STRIPE_SECRET_KEY unset → 503
 *   - AUTH_SECRET / DATABASE_URL unset → 503
 *   - No subscription / no stripeCustomerId → 400 with clear message
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth, authEnabled } from "@/auth";
import {
  stripe,
  stripeEnabled,
  stripeNotConfiguredResponse,
  appUrl,
} from "@/lib/stripe";

export async function POST() {
  if (!stripeEnabled || !stripe) {
    return stripeNotConfiguredResponse();
  }
  if (!authEnabled || !dbAvailable) {
    return NextResponse.json(
      {
        error:
          "Billing portal is disabled — multi-tenant features require AUTH_SECRET and DATABASE_URL.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json(
      { error: "Your user isn't attached to an agency." },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.agencyId, agencyId))
    .limit(1);
  const sub = rows[0];
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe customer on file for your agency. Subscribe first at /pricing.",
      },
      { status: 400 },
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl()}/admin/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
