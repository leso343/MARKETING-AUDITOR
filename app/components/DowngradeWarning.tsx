"use client";

/**
 * Subscription downgrade/expiry warning banner.
 *
 * Shows at the top of the app when the subscription is in a degraded state:
 *   - past_due  → "Payment failed" with update payment CTA
 *   - canceled  → "Subscription canceled" with reactivate CTA
 *   - incomplete → "Setup incomplete" with complete setup CTA
 *
 * Rendered from the root layout or admin layout. Gets subscription status
 * from a server component prop.
 */
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, X, XCircle, Clock } from "lucide-react";

export type WarningStatus =
  | "past_due"
  | "canceled"
  | "incomplete"
  | null;

const CONFIG: Record<
  string,
  {
    icon: typeof AlertTriangle;
    color: string;
    bg: string;
    title: string;
    message: string;
    cta: string;
    href: string;
  }
> = {
  past_due: {
    icon: AlertTriangle,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    title: "Payment failed",
    message:
      "Your last payment didn't go through. Update your payment method to keep your subscription active.",
    cta: "Update payment",
    href: "/admin/billing",
  },
  canceled: {
    icon: XCircle,
    color: "#64748b",
    bg: "rgba(100,116,139,0.08)",
    title: "Subscription canceled",
    message:
      "Your subscription has ended. Reactivate to regain access to Pro/Agency features.",
    cta: "View plans",
    href: "/pricing",
  },
  incomplete: {
    icon: Clock,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    title: "Setup incomplete",
    message:
      "Your subscription setup wasn't completed. Finish checkout to activate your plan.",
    cta: "Complete setup",
    href: "/pricing",
  },
};

export default function DowngradeWarning({
  status,
}: {
  status: WarningStatus;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (!status || dismissed || !CONFIG[status]) return null;

  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div
      className="border-b px-4 py-3"
      style={{
        backgroundColor: cfg.bg,
        borderColor: `${cfg.color}22`,
      }}
      role="alert"
    >
      <div className="mx-auto max-w-7xl flex items-center gap-3 flex-wrap">
        <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-semibold mr-2"
            style={{ color: cfg.color }}
          >
            {cfg.title}
          </span>
          <span className="text-xs text-[var(--text-dim)]">{cfg.message}</span>
        </div>
        <Link
          href={cfg.href}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: cfg.color }}
        >
          <CreditCard className="h-3 w-3" />
          {cfg.cta}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors shrink-0"
          aria-label="Dismiss warning"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
