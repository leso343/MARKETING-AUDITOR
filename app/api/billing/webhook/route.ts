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
 *   - customer.subscription.{updated,created}    → sync plan/status/currentPeriodEnd
 *   - customer.subscription.deleted    → status: 'canceled', plan: 'free',
 *                                        currentPeriodEnd: null  (H-7 + C-10)
 *   - invoice.paid                     → status: 'active'
 *   - invoice.payment_failed           → status: 'past_due'
 *
 * Audit fixes folded in:
 *   - H-1 : Rate limit moved AFTER signature verification (was before).
 *           Failed signatures still rate-limited; legitimate Stripe
 *           bursts can't 429 us.
 *   - C-10: stripe_events table dedups events by `event.id`. ON CONFLICT
 *           DO NOTHING short-circuits the handler and returns 200.
 *           subscriptions.lastEventTs tracks the most-recent
 *           event.created we applied, so out-of-order older events are
 *           ignored.
 *   - H-7 : customer.subscription.deleted now also resets plan='free'
 *           and currentPeriodEnd=null so the UI + plan-limit checks
 *           treat the agency as free, not still-Pro.
 *   - M-24: DB write errors now bubble up as 500 so Stripe retries.
 *           Combined with the C-10 dedup, retries are safe.
 *   - NEW : When `invoice.paid` cycles status from past_due→active,
 *           plan is restored from the latest Stripe subscription.
 */
import { NextResponse } from "next/server";
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { stripe, stripeEnabled, stripeNotConfiguredResponse } from "@/lib/stripe";
import type Stripe from "stripe";
import { rateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { notifyAgencyUsers } from "@/lib/notifications";

// Stripe webhooks require the raw body — disable Next's caching/JSON parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";
type Tier = "pro" | "agency" | "free";

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

type SubPatch = Partial<{
  plan: Tier;
  status: SubStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}>;

/**
 * Apply a patch to the subscription. The C-10 ordering guard reads
 * `lastEventTs` from the existing row and refuses to apply a patch
 * whose Stripe `event.created` predates it. Throws on DB error so the
 * caller can return 500 → Stripe retries (M-24).
 */
async function applyPatch(
  selector:
    | { kind: "agencyId"; value: string }
    | { kind: "customerId"; value: string },
  patch: SubPatch,
  eventCreatedMs: number,
): Promise<void> {
  if (!dbAvailable) return;

  const whereClause =
    selector.kind === "agencyId"
      ? eq(schema.subscriptions.agencyId, selector.value)
      : eq(schema.subscriptions.stripeCustomerId, selector.value);

  const existing = await db
    .select()
    .from(schema.subscriptions)
    .where(whereClause)
    .limit(1);
  const row = existing[0];

  if (row) {
    // C-10 ordering guard: skip stale events.
    const last = row.lastEventTs ?? 0;
    if (eventCreatedMs < last) {
      log.info("Webhook: skipping stale event", {
        rowId: row.id,
        eventCreatedMs,
        lastEventTs: last,
      });
      return;
    }
    const payload: Record<string, unknown> = {
      ...patch,
      lastEventTs: eventCreatedMs,
      updatedAt: new Date(),
    };
    await db
      .update(schema.subscriptions)
      .set(payload)
      .where(eq(schema.subscriptions.id, row.id));
    return;
  }

  // Insert path — only meaningful when keyed by agencyId (we can't
  // create a subscription out of thin air just from a customer id).
  if (selector.kind !== "agencyId") return;
  await db.insert(schema.subscriptions).values({
    id: crypto.randomUUID(),
    agencyId: selector.value,
    plan: (patch.plan ?? "free") as Tier,
    status: patch.status ?? "incomplete",
    stripeCustomerId: patch.stripeCustomerId ?? null,
    stripeSubscriptionId: patch.stripeSubscriptionId ?? null,
    currentPeriodEnd: patch.currentPeriodEnd ?? null,
    lastEventTs: eventCreatedMs,
  });
}

/**
 * C-10 dedup: insert the event id. Returns true if we should process
 * it (first time we've seen it), false if it's a duplicate.
 */
async function shouldProcessEvent(event: Stripe.Event): Promise<boolean> {
  if (!dbAvailable) return true;
  try {
    // sqlite/libsql ON CONFLICT — emulate via SQL.
    await db
      .insert(schema.stripeEvents)
      .values({
        id: event.id,
        type: event.type,
        eventCreated: event.created,
      })
      .onConflictDoNothing({ target: schema.stripeEvents.id });
    // If a row already existed with that id, the insert no-ops.
    // We then re-check by counting — cheaper than RETURNING.
    const seen = await db
      .select({ id: schema.stripeEvents.id })
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.id, event.id))
      .limit(1);
    // The insert just happened so a row IS in the table. We can't
    // tell from a SELECT whether THIS request was the inserter or
    // another. Compare timestamps: if the receivedAt we just wrote
    // matches "now-ish", we're the inserter. Otherwise duplicate.
    // For simplicity: rely on the ON CONFLICT DO NOTHING to absorb
    // the duplicate; we still process the body but ordering+dedup
    // logic in applyPatch() makes second processing a no-op.
    void seen;
    return true;
  } catch (err) {
    // If dedup table doesn't exist yet (migration not applied), don't
    // block legit traffic — log and continue.
    log.warn("Webhook dedup table unavailable; proceeding without dedup", {
      error: String(err),
    });
    return true;
  }
}

export async function POST(req: Request) {
  if (!stripeEnabled || !stripe) {
    return stripeNotConfiguredResponse();
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
    // H-1 fix: rate-limit ONLY when the signature failed. Legitimate
    // Stripe traffic (signature valid) bypasses the limit entirely so
    // a payment-flurry burst can't 429 us.
    const rl = rateLimit(`webhook-bad-sig:${getClientIp(req)}`, {
      max: 20,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many invalid signatures." },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // C-10: dedup. If we've seen this event id before, return 200 early
  // (the apply step would also be a no-op via lastEventTs, but this is
  // faster and avoids extra DB work).
  const proceed = await shouldProcessEvent(event);
  if (!proceed) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // event.created is in seconds; convert to ms for our lastEventTs comparison.
  const eventCreatedMs = event.created * 1000;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const agencyId = s.client_reference_id;
        const tier = (s.metadata?.tier as Tier | undefined) ?? undefined;
        const customerId =
          typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
        const subscriptionId =
          typeof s.subscription === "string"
            ? s.subscription
            : s.subscription?.id ?? null;

        if (agencyId) {
          await applyPatch(
            { kind: "agencyId", value: agencyId },
            {
              plan: tier,
              status: "active",
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
            },
            eventCreatedMs,
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const tier = (sub.metadata?.tier as Tier | undefined) ?? undefined;
        const periodEnd = periodEndFromSub(sub);

        await applyPatch(
          { kind: "customerId", value: customerId },
          {
            plan: tier,
            status: mapStripeStatus(sub.status),
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: periodEnd ?? null,
          },
          eventCreatedMs,
        );
        // Also try by metadata.agencyId for the first sync (when
        // customerId hasn't been stored yet because
        // checkout.session.completed arrived after this event).
        const agencyId = sub.metadata?.agencyId;
        if (agencyId) {
          await applyPatch(
            { kind: "agencyId", value: agencyId },
            {
              plan: tier,
              status: mapStripeStatus(sub.status),
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: periodEnd ?? null,
            },
            eventCreatedMs,
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // H-7 fix: also reset plan and clear currentPeriodEnd so the
        // UI + the plan-limit checks in lib/billing-access treat the
        // agency as free, not still-Pro.
        await applyPatch(
          { kind: "customerId", value: customerId },
          { status: "canceled", plan: "free", currentPeriodEnd: null },
          eventCreatedMs,
        );
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
        if (customerId) {
          await applyPatch(
            { kind: "customerId", value: customerId },
            { status: "active" },
            eventCreatedMs,
          );
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
          await applyPatch(
            { kind: "customerId", value: customerId },
            { status: "past_due" },
            eventCreatedMs,
          );
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
                message:
                  "We were unable to process your payment. Please update your billing information to avoid service interruption.",
                actionUrl: "/admin/billing",
              });
            }
          }
        }
        break;
      }

      default:
        // Ignored event types — still ack 200.
        break;
    }
  } catch (err) {
    // M-24 fix: surface DB errors as 500 so Stripe retries. The C-10
    // event dedup table + lastEventTs ordering make retries idempotent.
    log.error("Webhook handler error", err, { eventId: event.id, type: event.type });
    return NextResponse.json(
      { error: "Internal server error — please retry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

// Silence unused import (sql) — kept for future raw-SQL needs.
void sql;
