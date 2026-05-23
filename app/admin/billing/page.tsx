/**
 * /admin/billing — subscription overview + management.
 */
import Link from "next/link";
import { requireUser, getCurrentAgency } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  CreditCard,
  Zap,
  Calendar,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import ManageSubscriptionButton from "./ManageSubscriptionButton";

export const dynamic = "force-dynamic";

const PLAN_CONFIG: Record<string, { label: string; price: string; color: string; icon: typeof Zap }> = {
  free: { label: "Free", price: "$0/mo", color: "#64748b", icon: Zap },
  pro: { label: "Pro", price: "$49/mo", color: "#f59e0b", icon: Sparkles },
  agency: { label: "Agency", price: "$199/mo", color: "#8b5cf6", icon: ShieldCheck },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  trialing: { label: "Trialing", color: "#38bdf8", icon: Zap },
  active: { label: "Active", color: "#10b981", icon: ShieldCheck },
  past_due: { label: "Past due", color: "#f59e0b", icon: AlertTriangle },
  canceled: { label: "Canceled", color: "#64748b", icon: XCircle },
  incomplete: { label: "Incomplete", color: "#ef4444", icon: AlertTriangle },
};

export default async function AdminBillingPage() {
  await requireUser();
  const agency = await getCurrentAgency();

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
            &gt; Admin / Billing
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>Billing</h1>
        </div>
        <div className="panel flex flex-col items-center justify-center py-12 text-center">
          <CreditCard className="h-10 w-10 text-[var(--text-dim)] mb-3" />
          <div className="text-sm font-semibold">No agency attached</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Your user isn&apos;t assigned to an agency. Billing is per-agency.
          </div>
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

  const plan = PLAN_CONFIG[sub?.plan ?? "free"] ?? PLAN_CONFIG.free;
  const status = STATUS_CONFIG[sub?.status ?? "trialing"] ?? STATUS_CONFIG.trialing;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Billing
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>Billing</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Subscription for <span className="text-[var(--text)] font-medium">{agency.name}</span>
        </p>
      </div>

      {!sub ? (
        /* ── no subscription yet ─────────────────────────────────── */
        <div className="panel">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)] mb-4">
              <CreditCard className="h-7 w-7 text-[var(--text-dim)]" />
            </div>
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
              No active subscription
            </h2>
            <p className="text-sm text-[var(--text-dim)] mt-1 max-w-md">
              Pick a plan to unlock advanced features like white-label branding,
              unlimited clients, and priority support.
            </p>
            <Link
              href="/pricing"
              className="mt-5 flex items-center gap-2 rounded bg-[var(--red)] px-5 py-2.5 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              View plans
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : (
        /* ── active subscription ─────────────────────────────────── */
        <>
          {/* plan card */}
          <div className="panel overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: `linear-gradient(90deg, ${plan.color}, ${status.color})` }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: `${plan.color}33`,
                    background: `${plan.color}0a`,
                  }}
                >
                  <plan.icon className="h-6 w-6" style={{ color: plan.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl font-bold"
                      style={{ fontFamily: "var(--font-head)", color: plan.color }}
                    >
                      {plan.label}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                      style={{ borderColor: `${status.color}55`, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="font-mono text-sm text-[var(--text-dim)] mt-0.5">
                    {plan.price}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {sub.stripeCustomerId ? (
                  <ManageSubscriptionButton />
                ) : (
                  <Link
                    href="/pricing"
                    className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    Complete setup
                  </Link>
                )}
                <Link
                  href="/pricing"
                  className="flex items-center gap-1.5 rounded border border-[var(--border)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--text)] transition-all"
                >
                  Change plan
                </Link>
              </div>
            </div>
          </div>

          {/* detail grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Plan",
                value: plan.label,
                sub: plan.price,
                icon: plan.icon,
                color: plan.color,
              },
              {
                label: "Status",
                value: status.label,
                sub:
                  sub.status === "active"
                    ? "Everything is good"
                    : sub.status === "past_due"
                    ? "Please update payment"
                    : "",
                icon: status.icon,
                color: status.color,
              },
              {
                label: "Next billing",
                value: sub.currentPeriodEnd
                  ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                  : "—",
                sub: sub.currentPeriodEnd
                  ? `${Math.max(0, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / 86400000))} days away`
                  : "",
                icon: Calendar,
                color: "#64748b",
              },
              {
                label: "Customer ID",
                value: sub.stripeCustomerId
                  ? `${sub.stripeCustomerId.slice(0, 12)}…`
                  : "—",
                sub: "Stripe reference",
                icon: CreditCard,
                color: "#64748b",
              },
            ].map((card, i) => (
              <div key={i} className="panel">
                <div className="flex items-center gap-2 mb-3">
                  <card.icon className="h-3.5 w-3.5" style={{ color: card.color }} />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
                    {card.label}
                  </span>
                </div>
                <div className="text-lg font-bold" style={{ color: card.color }}>
                  {card.value}
                </div>
                {card.sub && (
                  <div className="font-mono text-[9px] text-[var(--text-dim)] mt-0.5">
                    {card.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
