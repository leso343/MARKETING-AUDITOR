/**
 * H-8 fix: canonical plan definitions — single source of truth for prices,
 * limits, and feature flags. Imported by:
 *   - app/pricing/page.tsx        (display)
 *   - app/pricing/PricingCard.tsx (display)
 *   - app/admin/billing/page.tsx  (display)
 *   - app/api/clients/route.ts    (limit enforcement)
 *   - app/api/clients/[slug]/csvs/route.ts (limit enforcement)
 *   - app/api/users/route.ts      (seat limit)
 *   - app/audit/[client]/page.tsx (audit-cap enforcement)
 *
 * Pricing kept aligned with .env.example STRIPE_*_PRICE_ID comments —
 * Pro $99/mo ($79/mo annual), Agency $299/mo ($239/mo annual). Annual
 * reflects the ~20% discount the pricing-page FAQ promises.
 */
export type PlanId = "free" | "pro" | "agency";

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
    auditsPerMonth: 1,
    csvsPerClient: 5,
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
    monthlyPrice: 299,
    annualPrice: 239,
    clientLimit: Number.POSITIVE_INFINITY,
    seatLimit: 10,
    auditsPerMonth: Number.POSITIVE_INFINITY,
    csvsPerClient: Number.POSITIVE_INFINITY,
  },
};

/** Days a free trial lasts before access cuts off. */
export const FREE_TRIAL_DAYS = 14;

/** Grace period after `payment_failed` before access is revoked. */
export const PAST_DUE_GRACE_DAYS = 7;
