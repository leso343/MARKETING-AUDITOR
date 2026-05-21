"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";

interface Props {
  plan: "free" | "pro" | "agency";
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export default function PricingCard(props: Props) {
  const [pending, startTransition] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubscribe = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: props.plan }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.url) {
        window.location.href = j.url as string;
        return;
      }
      // Stub response from current endpoint
      if (j.message) setInfo(j.message);
      else setError(`Unexpected response (${res.status})`);
    });
  };

  return (
    <div className={`panel flex flex-col ${props.highlighted ? "border-[var(--red)]" : ""}`}>
      <div className="panel-label">{props.name}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold" style={{ fontFamily: "var(--font-head)" }}>{props.price}</span>
        <span className="text-xs font-mono text-[var(--text-dim)]">{props.period}</span>
      </div>
      <p className="text-xs text-[var(--text-dim)] mt-3">{props.description}</p>
      <ul className="mt-5 space-y-2 text-sm flex-1">
        {props.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 text-[var(--red)] shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={pending}
        className={`mt-6 w-full font-mono text-xs uppercase tracking-widest py-3 transition-colors ${
          props.highlighted
            ? "bg-[var(--red)] text-white hover:opacity-90"
            : "border border-[var(--border)] hover:border-[var(--red)] hover:text-[var(--red)]"
        } disabled:opacity-50`}
      >
        {pending ? "Working…" : props.cta}
      </button>
      {info && <div className="mt-3 text-[10px] font-mono text-emerald-400">{info}</div>}
      {error && <div className="mt-3 text-[10px] font-mono text-[var(--red)]">{error}</div>}
    </div>
  );
}
