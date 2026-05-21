/**
 * /pricing — public pricing page (no auth required).
 *
 * Tier 4 will wire the Subscribe buttons to Stripe Checkout. For now they
 * POST to /api/billing/checkout which returns a TODO message.
 */
import Link from "next/link";
import PricingCard from "./PricingCard";

export const dynamic = "force-static";

const PLANS = [
  {
    plan: "free" as const,
    name: "Free trial",
    price: "$0",
    period: "for 14 days",
    description: "One client, full audit access, watermark on PDFs.",
    features: [
      "1 client",
      "Unlimited audits while trialing",
      "Watermarked PDF export",
      "Email support",
    ],
    cta: "Start trial",
    highlighted: false,
  },
  {
    plan: "pro" as const,
    name: "Pro",
    price: "$99",
    period: "per month",
    description: "For solo operators running 1-5 active clients.",
    features: [
      "Up to 5 clients",
      "Unlimited audits",
      "Branded PDF export (no watermark)",
      "Email + chat support",
    ],
    cta: "Subscribe — Pro",
    highlighted: true,
  },
  {
    plan: "agency" as const,
    name: "Agency",
    price: "$299",
    period: "per month",
    description: "For agencies. White-label header, unlimited clients, multi-user.",
    features: [
      "Unlimited clients",
      "White-label header + logo + accent color",
      "Multiple user seats per agency",
      "Priority support",
    ],
    cta: "Subscribe — Agency",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen p-6 sm:p-12 lg:p-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-3">
            &gt; SNA_Forensic / Pricing
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: "var(--font-head)" }}>
            Forensic audits for your whole client roster.
          </h1>
          <p className="text-sm text-[var(--text-dim)] max-w-xl mx-auto">
            One CSV drop. Funnel leakage, geographic waste, creative deadweight,
            tracking failures — quantified to the dollar. Cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => <PricingCard key={p.plan} {...p} />)}
        </div>

        <div className="mt-12 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          Already have an account? <Link href="/login" className="text-white hover:text-[var(--red)]">Sign in →</Link>
        </div>
      </div>
    </main>
  );
}
