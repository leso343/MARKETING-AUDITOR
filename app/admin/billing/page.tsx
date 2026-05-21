/**
 * /admin/billing — current agency's subscription overview.
 *
 * Shows: tier, status, next billing date, "Manage subscription" button that
 * POSTs to /api/billing/portal and redirects to the Stripe Customer Portal.
 *
 * Access:
 *   - Wrapped in the existing /admin layout, which already requires auth+DB.
 *   - Resolves agency via the session user's agencyId.
 */
import Link from "next/link";
import { requireUser, getCurrentAgency } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import ManageSubscriptionButton from "./ManageSubscriptionButton";

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  free: "Free trial",
  pro: "Pro — $99/mo",
  agency: "Agency — $299/mo",
};
const STATUS_LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
};

export default async function AdminBillingPage() {
  await requireUser();
  const agency = await getCurrentAgency();

  if (!agency) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
            &gt; Admin / Billing
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
            Billing
          </h1>
        </div>
        <div className="panel text-sm text-[var(--text-dim)]">
          Your user isn&apos;t attached to an agency. Billing is per-agency.
        </div>
      </div>
    );
  }

  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.agencyId, agency.id))
    .limit(1);
  const sub = subs[0] ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Billing
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
          Billing
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Subscription state for <span className="font-mono">{agency.name}</span>.
        </p>
      </div>

      <div className="panel space-y-4">
        <div className="panel-label">Current plan</div>

        {!sub ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-dim)]">
              No subscription on file. Pick a plan to get started.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
            >
              View pricing →
            </Link>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Plan
                </dt>
                <dd className="mt-1">{PLAN_LABELS[sub.plan] ?? sub.plan}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Status
                </dt>
                <dd className="mt-1">
                  <span
                    className={
                      sub.status === "active" || sub.status === "trialing"
                        ? "text-emerald-400"
                        : sub.status === "past_due"
                        ? "text-amber-400"
                        : "text-[var(--text-dim)]"
                    }
                  >
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Next billing
                </dt>
                <dd className="mt-1 font-mono">
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                  Stripe customer
                </dt>
                <dd className="mt-1 font-mono text-[var(--text-dim)]">
                  {sub.stripeCustomerId ?? "—"}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3 pt-2">
              {sub.stripeCustomerId ? (
                <ManageSubscriptionButton />
              ) : (
                <Link
                  href="/pricing"
                  className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
                >
                  Complete subscription
                </Link>
              )}
              <Link
                href="/pricing"
                className="inline-block border border-[var(--border)] hover:border-[var(--red)] font-mono text-xs uppercase tracking-widest px-4 py-2"
              >
                Change plan
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
