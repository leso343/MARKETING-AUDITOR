/**
 * GET /api/billing/verify?session_id=cs_...
 *
 * Called from /billing/success after Stripe redirects the user back.
 * Confirms the checkout session was paid and updates the local
 * Subscription row (lookup by client_reference_id = agencyId).
 *
 * Returns: { ok, status, tier, currentPeriodEnd } on success.
 *
 * ─── Deploy-safe guard ─────────────────────────────────────────────────────
 *   - STRIPE_SECRET_KEY unset → 503
 *   - DB unavailable → still verify with Stripe and return the result, but
 *     skip the DB write (user-safe info still useful for the success page).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe, stripeEnabled, stripeNotConfiguredResponse } from "@/lib/stripe";
import { log } from "@/lib/logger";

export async function GET(req: Request) {
  if (!stripeEnabled || !stripe) {
    return stripeNotConfiguredResponse();
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id query param." },
      { status: 400 },
    );
  }

  let checkout;
  try {
    checkout = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const paid = checkout.payment_status === "paid" || checkout.status === "complete";
  if (!paid) {
    return NextResponse.json(
      {
        ok: false,
        paymentStatus: checkout.payment_status,
        status: checkout.status,
      },
      { status: 402 },
    );
  }

  // Extract the bits we need.
  const agencyId = checkout.client_reference_id ?? undefined;
  const tier = (checkout.metadata?.tier as "pro" | "agency" | undefined) ?? "pro";
  const customerId =
    typeof checkout.customer === "string"
      ? checkout.customer
      : checkout.customer?.id ?? null;
  const sub = typeof checkout.subscription === "string" ? null : checkout.subscription ?? null;
  const subscriptionId = sub?.id ?? (typeof checkout.subscription === "string" ? checkout.subscription : null);
  // The Subscription object on this API version may expose either
  // `current_period_end` (older) or items[].current_period_end (newer).
  const periodEndSec: number | null =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sub as any)?.current_period_end ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sub as any)?.items?.data?.[0]?.current_period_end ??
    null;
  const currentPeriodEnd = periodEndSec ? new Date(periodEndSec * 1000) : null;

  // Skip DB writes when DB is unavailable.
  if (dbAvailable && agencyId) {
    try {
      const existing = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.agencyId, agencyId))
        .limit(1);

      const updates: Record<string, unknown> = {
        plan: tier,
        status: "active",
        updatedAt: new Date(),
      };
      if (customerId) updates.stripeCustomerId = customerId;
      if (subscriptionId) updates.stripeSubscriptionId = subscriptionId;
      if (currentPeriodEnd) updates.currentPeriodEnd = currentPeriodEnd;

      if (existing[0]) {
        await db
          .update(schema.subscriptions)
          .set(updates)
          .where(eq(schema.subscriptions.id, existing[0].id));
      } else {
        await db.insert(schema.subscriptions).values({
          id: crypto.randomUUID(),
          agencyId,
          plan: tier,
          status: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: currentPeriodEnd ?? undefined,
        });
      }
    } catch (err) {
      log.warn("Billing verify DB update failed (continuing)", { error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    tier,
    status: "active",
    currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
  });
}
