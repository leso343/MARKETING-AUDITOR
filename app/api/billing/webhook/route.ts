/**
 * POST /api/billing/webhook — Stripe event receiver.
 *
 * Signature verified against STRIPE_WEBHOOK_SECRET. The raw request body
 * (NOT the parsed JSON) is required for `stripe.webhooks.constructEvent` to
 * recompute the HMAC. In the Next.js App Router we get raw bytes via
 * `await req.text()`.
 *
 * Handled events:
 *   - checkout.session.completed       → mark subscription active, store IDs
 *   - customer.subscription.updated    → sync plan/status/currentPeriodEnd
 *   - customer.subscription.deleted    → status: 'canceled'
 *   - invoice.paid                     → status: 'active'
 *   - invoice.payment_failed           → status: 'past_due'
 *
 * Returns 200 quickly. Errors during DB work are logged but still 200'd —
 * Stripe will retry on 5xx, and we don't want a transient DB blip to cause
 * Stripe to mark the endpoint unhealthy.
 *
 * ─── Deploy-safe guard ─────────────────────────────────────────────────────
 *   - STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset → 503
 *   - dbAvailable === false → signature verified, event ack'd 200, no DB
 *     writes (this lets Stripe webhook deliveries succeed on the deploy-safe
 *     no-DB deployment).
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe, stripeEnabled, stripeNotConfiguredResponse } from "@/lib/stripe";
import type Stripe from "stripe";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { notifyAgencyUsers } from "@/lib/notifications";

// Stripe webhooks require the raw body — disable Next's caching/JSON parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

function mapStripeStatus(s: Stripe.Subscription.Status | string): SubStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "incomplete";
    default:
      return "incomplete";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function periodEndFromSub(sub: Stripe.Subscription): Date | null {
  const sec: number | null =
    (sub as any).current_period_end ??
    (sub as any).items?.data?.[0]?.current_period_end ??
    null;
  return sec ? new Date(sec * 1000) : null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function updateByAgencyId(
  agencyId: string,
  patch: Partial<{
    plan: "pro" | "agency" | "free";
    status: SubStatus;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: Date;
  }>,
) {
  if (!dbAvailable) return;
  try {
    const existing = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.agencyId, agencyId))
      .limit(1);
    const payload: Record<string, unknown> = { ...patch, updatedAt: new Date() };
    if (existing[0]) {
      await db
        .update(schema.subscriptions)
        .set(payload)
        .where(eq(schema.subscriptions.id, existing[0].id));
    } else {
      await db.insert(schema.subscriptions).values({
        id: crypto.randomUUID(),
        agencyId,
        plan: (patch.plan ?? "free") as "pro" | "agency" | "free",
        status: patch.status ?? "incomplete",
        stripeCustomerId: patch.stripeCustomerId ?? null,
        stripeSubscriptionId: patch.stripeSubscriptionId ?? null,
        currentPeriodEnd: patch.currentPeriodEnd ?? undefined,
      });
    }
  } catch (err) {
    log.warn("Webhook DB write failed (event still ack'd)", { error: String(err) });
  }
}

async function updateByCustomerId(
  customerId: string,
  patch: Partial<{
    plan: "pro" | "agency" | "free";
    status: SubStatus;
    stripeSubscriptionId: string;
    currentPeriodEnd: Date;
  }>,
) {
  if (!dbAvailable) return;
  try {
    const rows = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.stripeCustomerId, customerId))
      .limit(1);
    if (!rows[0]) return;
    await db
      .update(schema.subscriptions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.subscriptions.id, rows[0].id));
  } catch (err) {
    log.warn("Webhook DB write failed (event still ack'd)", { error: String(err) });
  }
}

export async function POST(req: Request) {
  if (!stripeEnabled || !stripe) {
    return stripeNotConfiguredResponse();
  }

  // Rate limit: 100 requests per minute per IP (Stripe sends bursts)
  const rl = rateLimit(`webhook:${getClientIp(req)}`, { max: 100, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) {
    return NextResponse.json(
      { error: "Stripe not configured — set STRIPE_WEBHOOK_SECRET" },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Raw body required for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const agencyId = s.client_reference_id;
        const tier = (s.metadata?.tier as "pro" | "agency" | undefined) ?? undefined;
        const customerId =
          typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
        const subscriptionId =
          typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;

        if (agencyId) {
          await updateByAgencyId(agencyId, {
            plan: tier,
            status: "active",
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const tier = (sub.metadata?.tier as "pro" | "agency" | undefined) ?? undefined;
        const periodEnd = periodEndFromSub(sub);

        await updateByCustomerId(customerId, {
          plan: tier,
          status: mapStripeStatus(sub.status),
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEnd ?? undefined,
        });
        // Also try by metadata.agencyId for the first sync (when customerId
        // hasn't been stored yet because checkout.session.completed arrived
        // after this event).
        const agencyId = sub.metadata?.agencyId;
        if (agencyId) {
          await updateByAgencyId(agencyId, {
            plan: tier,
            status: mapStripeStatus(sub.status),
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: periodEnd ?? undefined,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await updateByCustomerId(customerId, { status: "canceled" });
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
        if (customerId) {
          await updateByCustomerId(customerId, { status: "active" });
          // Notify agency users that payment succeeded (only for renewals, not first)
          if (dbAvailable) {
            const subRows = await db
              .select({ agencyId: schema.subscriptions.agencyId })
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.stripeCustomerId, customerId))
              .limit(1);
            if (subRows[0]?.agencyId) {
              await notifyAgencyUsers(subRows[0].agencyId, {
                type: "payment_resolved",
                title: "Payment successful",
                message: "Your subscription payment has been processed successfully.",
                actionUrl: "/admin/billing",
              });
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
        if (customerId) {
          await updateByCustomerId(customerId, { status: "past_due" });
          // Notify agency users about the payment issue
          if (dbAvailable) {
            const subRows = await db
              .select({ agencyId: schema.subscriptions.agencyId })
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.stripeCustomerId, customerId))
              .limit(1);
            if (subRows[0]?.agencyId) {
              await notifyAgencyUsers(subRows[0].agencyId, {
                type: "payment_issue",
                title: "Payment failed",
                message: "We were unable to process your payment. Please update your billing information to avoid service interruption.",
                actionUrl: "/admin/billing",
              });
            }
          }
        }
        break;
      }

      default:
        // Ignored.
        break;
    }
  } catch (err) {
    log.error("Webhook handler error", err);
    // Still 200 — Stripe retries on 5xx and we already verified the signature.
  }

  return NextResponse.json({ received: true });
}
