/**
 * Per-agency billing enforcement helpers — used by mutation API routes
 * and the audit page before doing privileged work. Fixes C-6 (no
 * subscription-status enforcement) and powers C-7 caps (CSV / audit /
 * seat).
 */
import { db, schema, dbAvailable } from "@/lib/db";
import { eq, and, gte, count } from "drizzle-orm";
import {
  PLANS,
  type PlanId,
  type PlanInfo,
  FREE_TRIAL_DAYS,
  PAST_DUE_GRACE_DAYS,
} from "@/lib/plans";

export type BillingState =
  | { ok: true; plan: PlanInfo; status: schema.Subscription["status"]; sub: schema.Subscription | null }
  | { ok: false; reason: string; code: string; plan: PlanInfo };

/**
 * Resolve the current billing state for an agency and decide whether
 * privileged actions are allowed.
 *
 * Joint plan + status decision:
 *   - free + trialing within 14 days → ok
 *   - free + trialing after 14 days  → not ok (expired)
 *   - paid + active                   → ok
 *   - paid + trialing                 → ok (Stripe trial)
 *   - past_due → ok within 7-day grace, then not ok
 *   - canceled / incomplete → not ok
 */
export async function getBillingState(agencyId: string): Promise<BillingState> {
  if (!dbAvailable) {
    return { ok: true, plan: PLANS.free, status: "trialing", sub: null };
  }

  const rows = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.agencyId, agencyId))
    .limit(1);
  const sub = rows[0] ?? null;

  if (!sub) {
    return {
      ok: false,
      reason: "No active subscription. Start your free trial or pick a plan.",
      code: "NO_SUBSCRIPTION",
      plan: PLANS.free,
    };
  }

  const plan = PLANS[(sub.plan as PlanId) ?? "free"] ?? PLANS.free;

  if (sub.status === "active") {
    return { ok: true, plan, status: sub.status, sub };
  }

  if (sub.status === "trialing") {
    if (plan.id === "free") {
      const trialStart = sub.trialStartedAt?.getTime() ?? sub.createdAt.getTime();
      const trialEndMs = trialStart + FREE_TRIAL_DAYS * 86_400_000;
      if (Date.now() > trialEndMs) {
        return {
          ok: false,
          reason: `Your ${FREE_TRIAL_DAYS}-day free trial has ended. Upgrade to continue.`,
          code: "TRIAL_EXPIRED",
          plan,
        };
      }
    }
    return { ok: true, plan, status: sub.status, sub };
  }

  if (sub.status === "past_due") {
    const since = sub.updatedAt.getTime();
    if (Date.now() - since < PAST_DUE_GRACE_DAYS * 86_400_000) {
      return { ok: true, plan, status: sub.status, sub };
    }
    return {
      ok: false,
      reason: "Payment failed and the grace period has elapsed. Update your card on the billing page.",
      code: "PAST_DUE",
      plan,
    };
  }

  if (sub.status === "canceled" || sub.status === "incomplete") {
    return {
      ok: false,
      reason:
        sub.status === "canceled"
          ? "Your subscription has been canceled. Re-subscribe to continue."
          : "Subscription setup is incomplete. Complete checkout to continue.",
      code: sub.status.toUpperCase(),
      plan: PLANS.free,
    };
  }

  return { ok: false, reason: "Unknown subscription status.", code: "UNKNOWN", plan };
}

/** Count audits run by this agency in the current calendar month. */
export async function countMonthlyAudits(agencyId: string): Promise<number> {
  if (!dbAvailable) return 0;
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({ c: count() })
    .from(schema.auditRuns)
    .where(
      and(
        eq(schema.auditRuns.agencyId, agencyId),
        gte(schema.auditRuns.ranAt, startOfMonth),
      ),
    );
  return rows[0]?.c ?? 0;
}

/** Insert an audit-run log row. Best-effort — failures don't block the request. */
export async function logAuditRun(agencyId: string, clientId: string): Promise<void> {
  if (!dbAvailable) return;
  try {
    const { randomUUID } = await import("node:crypto");
    await db.insert(schema.auditRuns).values({
      id: randomUUID(),
      agencyId,
      clientId,
    });
  } catch {
    /* best-effort */
  }
}

export async function countAgencySeats(agencyId: string): Promise<number> {
  if (!dbAvailable) return 0;
  const rows = await db
    .select({ c: count() })
    .from(schema.users)
    .where(eq(schema.users.agencyId, agencyId));
  return rows[0]?.c ?? 0;
}

export async function countAgencyClients(agencyId: string): Promise<number> {
  if (!dbAvailable) return 0;
  const rows = await db
    .select({ c: count() })
    .from(schema.clients)
    .where(eq(schema.clients.agencyId, agencyId));
  return rows[0]?.c ?? 0;
}

export async function countClientCsvs(clientId: string): Promise<number> {
  if (!dbAvailable) return 0;
  const rows = await db
    .select({ c: count() })
    .from(schema.csvFiles)
    .where(eq(schema.csvFiles.clientId, clientId));
  return rows[0]?.c ?? 0;
}

/**
 * Strict slug validator used by every route that accepts a slug from
 * a URL or body. Lowercase letters, digits, and hyphens; can't start
 * or end with a hyphen; 1-64 chars. Fixes H-2 / H-5.
 */
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

/** Returns the slug if it passes SLUG_RE, otherwise null. */
export function safeSlug(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.toLowerCase();
  return SLUG_RE.test(s) ? s : null;
}
