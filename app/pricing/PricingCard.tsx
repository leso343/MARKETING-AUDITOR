"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useBillingPeriod } from "./BillingToggle";

interface Props {
  plan: "free" | "pro" | "agency";
  name: string;
  price: string;
  annualPrice?: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export default function PricingCard(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { period: billingPeriod } = useBillingPeriod();

  // Free tier doesn't hit Stripe — point at /login (or /admin if already in).
  if (props.plan === "free") {
    return (
      <div className={`panel flex flex-col ${props.highlighted ? "border-[var(--red)]" : ""}`}>
        <div className="panel-label">{props.name}</div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-bold" style={{ fontFamily: "var(--font-head)" }}>{props.price}</span>
          <span className="text-xs font-mono text-[var(--text-dim)]">{props.period}</span>
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-3">{props.description}</p>
        <ul className="mt-5 space-y-2 text-sm flex-1">
          {props.features.map((f) => {
            const [featureName, badge] = f.split(" · ");
            return (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-[var(--red)] shrink-0" />
                <span>
                  {featureName}
                  {badge && (
                    <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/login"
          className="mt-6 w-full inline-block text-center border border-[var(--border)] hover:border-[var(--red)] hover:text-[var(--red)] font-mono text-xs uppercase tracking-widest py-3"
        >
          {props.cta}
        </Link>
      </div>
    );
  }

  const displayPrice = billingPeriod === "annual" && props.annualPrice ? props.annualPrice : props.price;
  const displayPeriod = billingPeriod === "annual" ? "per month, billed annually" : props.period;

  const onSubscribe = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: props.plan, period: billingPeriod }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.url) {
          window.location.href = j.url as string;
          return;
        }
        if (res.status === 401) {
          // Bounce to login, then back to pricing.
          window.location.href = `/login?from=${encodeURIComponent("/pricing")}`;
          return;
        }
        setError(j.error ?? j.message ?? `Checkout failed (HTTP ${res.status}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      }
    });
  };

  return (
    <div className={`panel flex flex-col ${props.highlighted ? "border-[var(--red)]" : ""}`}>
      <div className="panel-label">{props.name}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold" style={{ fontFamily: "var(--font-head)" }}>{displayPrice}</span>
        <span className="text-xs font-mono text-[var(--text-dim)]">{displayPeriod}</span>
      </div>
      {billingPeriod === "annual" && props.annualPrice && (
        <div className="mt-1 text-[10px] font-mono text-emerald-400">
          <span className="line-through text-[var(--text-dim)]">{props.price}/mo</span>
          {" → "}{props.annualPrice}/mo
        </div>
      )}
      <p className="text-xs text-[var(--text-dim)] mt-3">{props.description}</p>
      <ul className="mt-5 space-y-2 text-sm flex-1">
        {props.features.map((f) => {
          const [featureName, badge] = f.split(" · ");
          return (
            <li key={f} className="flex items-start gap-2">
              <Check className="h-4 w-4 mt-0.5 text-[var(--red)] shrink-0" />
              <span>
                {featureName}
                {badge && (
                  <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={pending}
        aria-label={`Subscribe to ${props.name} plan`}
        className={`mt-6 w-full font-mono text-xs uppercase tracking-widest py-3 transition-colors ${
          props.highlighted
            ? "bg-[var(--red)] text-white hover:opacity-90"
            : "border border-[var(--border)] hover:border-[var(--red)] hover:text-[var(--red)]"
        } disabled:opacity-50`}
      >
        {pending ? "Redirecting to Stripe…" : props.cta}
      </button>
      {error && (
        <div className="mt-3 text-[10px] font-mono text-[var(--red)] break-words" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
