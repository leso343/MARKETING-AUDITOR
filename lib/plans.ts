/**
 * Canonical plan definitions — single source of truth for prices,
 * limits, and feature flags. Imported by:
 *   - app/pricing/page.tsx        (display)
 *   - app/pricing/PricingCard.tsx (display)
 *   - app/admin/billing/page.tsx  (display)
 *   - app/api/clients/route.ts    (limit enforcement)
 *   - app/api/clients/[slug]/csvs/route.ts (limit enforcement)
 *   - app/api/users/route.ts      (seat limit)
 *   - app/audit/[client]/page.tsx (audit-cap enforcement)
 *   - lib/ai-usage.ts             (AI tier caps)
 *   - lib/stripe.ts               (price-id resolution)
 *
 * Tier structure (4 paid options + the trial):
 *   • Free trial — 7 days of FULL access, then hard-locked
 *   • Starter $49/mo  — 1 client    (solo consultants / freelancers)
 *   • Pro     $99/mo  — 5 clients   (small teams)
 *   • Agency $249/mo  — 50 clients + white-label + 10 seats (agencies)
 *   • Enterprise — custom (unlimited everything, SSO, SLA)
 *
 * Annual prices reflect the ~20% discount the pricing-page FAQ promises.
 */
export type PlanId = "free" | "starter" | "pro" | "agency";

export type PlanInfo = {
  id: PlanId;
  label: string;
  monthlyPrice: number;
  annualPrice: number; // per-month rate when billed annually
  /** Max active clients. Infinity = unlimited. */
  clientLimit: number;
  /** Max user seats on the agency. Infinity = unlimited. */
  seatLimit: number;
  /** Audits per calendar month. Infinity = unlimited. */
  auditsPerMonth: number;
  /** Max CSV files per client. */
  csvsPerClient: number;
};

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    label: "Free Trial",
    monthlyPrice: 0,
    annualPrice: 0,
    clientLimit: 1,
    seatLimit: 1,
    // Trial gets FULL access — the point is to convert. Limit is the
    // 7-day clock (enforced in billing-access.ts), not feature gating.
    auditsPerMonth: Number.POSITIVE_INFINITY,
    csvsPerClient: 20,
  },
  starter: {
    id: "starter",
    label: "Starter",
    monthlyPrice: 49,
    annualPrice: 39,
    clientLimit: 1,
    seatLimit: 1,
    auditsPerMonth: Number.POSITIVE_INFINITY,
    csvsPerClient: 20,
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyPrice: 99,
    annualPrice: 79,
    clientLimit: 5,
    seatLimit: 1,
    auditsPerMonth: Number.POSITIVE_INFINITY,
    csvsPerClient: 20,
  },
  agency: {
    id: "agency",
    label: "Agency",
    monthlyPrice: 249,
    annualPrice: 199,
    clientLimit: 50,
    seatLimit: 10,
    auditsPerMonth: Number.POSITIVE_INFINITY,
    csvsPerClient: Number.POSITIVE_INFINITY,
  },
};

/**
 * Days a free trial lasts before access cuts off (hard lock — see
 * lib/billing-access.ts → TRIAL_EXPIRED). Was 14, dropped to 7 to
 * force a quicker conversion decision.
 */
export const FREE_TRIAL_DAYS = 7;

/** Grace period after `payment_failed` before access is revoked. */
export const PAST_DUE_GRACE_DAYS = 7;

/**
 * Ordered list used for "upgrade-to-next-tier" messaging. When a user
 * hits the client limit on tier N, we suggest tier N+1.
 */
export const PAID_PLAN_ORDER: PlanId[] = ["starter", "pro", "agency"];

/** Returns the next paid tier above the given plan, or null if at top. */
export function nextPaidTier(current: PlanId): PlanId | null {
  if (current === "free") return "starter";
  const idx = PAID_PLAN_ORDER.indexOf(current);
  if (idx < 0 || idx === PAID_PLAN_ORDER.length - 1) return null;
  return PAID_PLAN_ORDER[idx + 1];
}
