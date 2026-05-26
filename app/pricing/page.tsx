/**
 * /pricing — public pricing page (no auth required).
 *
 * Subscribe buttons POST to /api/billing/checkout, which creates a Stripe
 * Checkout session and redirects the user to Stripe's hosted payment page.
 *
 * Tier ladder (see lib/plans.ts for the canonical limits):
 *   Free trial → Starter $49 → Pro $99 → Agency $249 → Enterprise.
 *   Hard lock after the 7-day trial — user MUST upgrade to keep using
 *   the account (enforced by lib/billing-access.getBillingState).
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  Zap,
  Sparkles,
  Crown,
  Building2,
  Check,
  Minus,
  ChevronDown,
  Rocket,
} from "lucide-react";
import PricingCard from "./PricingCard";
import BillingToggle, { BillingProvider } from "./BillingToggle";

/* ─── plan data ────────────────────────────────────────────────────────── */

const PLANS = [
  {
    plan: "free" as const,
    name: "Free Trial",
    price: "$0",
    period: "for 7 days",
    description:
      "Full Pro-tier access for 7 days. After that, upgrade to keep your account.",
    features: [
      "Full feature access",
      "1 client account",
      "Unlimited audits",
      "Full funnel leakage analysis",
      "Tracking failure detection",
      "Creative performance scoring",
      "Geographic waste heatmap",
      "AI assistant (25 messages)",
      "Branded PDF exports",
      "7-day hard lock — no credit card needed",
    ],
    cta: "Start free trial",
    highlighted: false,
    icon: Zap,
  },
  {
    plan: "starter" as const,
    name: "Starter",
    price: "$49",
    annualPrice: "$39",
    period: "per month",
    description:
      "For solo consultants and freelancers running one client account end-to-end.",
    features: [
      "1 client account",
      "Unlimited audits",
      "Full funnel leakage analysis",
      "Tracking failure detection",
      "Geographic waste heatmap",
      "Creative performance scoring",
      "Demographic deep-dive (age + gender)",
      "Branded PDF exports (no watermark)",
      "AI assistant (200 messages / month)",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
    icon: Rocket,
  },
  {
    plan: "pro" as const,
    name: "Pro",
    price: "$99",
    annualPrice: "$79",
    period: "per month",
    description:
      "For solo operators and small teams running 1 to 5 active client accounts with full audit capabilities.",
    features: [
      "Up to 5 client accounts",
      "Unlimited audits",
      "Everything in Starter, plus:",
      "Placement & device analysis",
      "Weekly trend tracking",
      "AI assistant (500 messages / month)",
      "Email + chat support",
    ],
    cta: "Get started",
    highlighted: true,
    icon: Sparkles,
  },
  {
    plan: "agency" as const,
    name: "Agency",
    price: "$249",
    annualPrice: "$199",
    period: "per month",
    description:
      "For agencies managing multiple clients. White-label branding, team seats, and advanced automation.",
    features: [
      "Up to 50 client accounts",
      "Everything in Pro, plus:",
      "White-label branding (logo, colors, fonts)",
      "Multiple user seats (up to 10)",
      "Time-of-day optimization analysis",
      "AI assistant (100/day per seat)",
      "Priority support (< 4hr response)",
      "Budget utilization monitoring",
    ],
    cta: "Get started",
    highlighted: false,
    icon: Crown,
  },
];

const ENTERPRISE_FEATURES = [
  "Everything in Agency, plus:",
  "Unlimited client accounts",
  "Unlimited user seats",
  "Full API access (no rate limits)",
  "SSO / SAML authentication",
  "Dedicated onboarding specialist",
  "Custom analysis modules",
  "SLA guarantee (99.9% uptime)",
  "Dedicated Slack channel support",
  "On-call account manager",
];

/* ─── comparison matrix ────────────────────────────────────────────────── */

type CellValue = boolean | string;

interface ComparisonRow {
  feature: string;
  free: CellValue;
  starter: CellValue;
  pro: CellValue;
  agency: CellValue;
  enterprise: CellValue;
}

const COMPARISON: ComparisonRow[] = [
  { feature: "Client accounts",            free: "1",         starter: "1",         pro: "Up to 5",   agency: "Up to 50",     enterprise: "Unlimited" },
  { feature: "Audits per month",           free: "Unlimited", starter: "Unlimited", pro: "Unlimited", agency: "Unlimited",    enterprise: "Unlimited" },
  { feature: "User seats",                 free: "1",         starter: "1",         pro: "1",         agency: "Up to 10",     enterprise: "Unlimited" },
  { feature: "Funnel leakage analysis",    free: true,        starter: true,        pro: true,        agency: true,           enterprise: true },
  { feature: "Tracking failure detection", free: true,        starter: true,        pro: true,        agency: true,           enterprise: true },
  { feature: "Geographic waste heatmap",   free: true,        starter: true,        pro: true,        agency: true,           enterprise: true },
  { feature: "Creative performance scoring", free: true,      starter: true,        pro: true,        agency: true,           enterprise: true },
  { feature: "Demographic deep-dive",      free: true,        starter: true,        pro: true,        agency: true,           enterprise: true },
  { feature: "Placement & device analysis", free: false,      starter: false,       pro: true,        agency: true,           enterprise: true },
  { feature: "Weekly trend tracking",      free: false,       starter: false,       pro: true,        agency: true,           enterprise: true },
  { feature: "PDF export",                 free: "Branded",   starter: "Branded",   pro: "Branded",   agency: "Branded",      enterprise: "Branded" },
  { feature: "White-label branding",       free: false,       starter: false,       pro: false,       agency: true,           enterprise: true },
  { feature: "Time-of-day optimization",   free: false,       starter: false,       pro: false,       agency: true,           enterprise: true },
  { feature: "Budget utilization monitoring", free: false,    starter: false,       pro: false,       agency: true,           enterprise: true },
  { feature: "AI assistant",               free: "25 lifetime", starter: "200/mo",  pro: "500/mo",    agency: "100/day/seat", enterprise: "Unlimited" },
  { feature: "SSO / SAML authentication",  free: false,       starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "Dedicated onboarding specialist", free: false,  starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "Custom analysis modules",    free: false,       starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "SLA guarantee (99.9% uptime)", free: false,     starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "Dedicated Slack channel support", free: false,  starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "On-call account manager",    free: false,       starter: false,       pro: false,       agency: false,          enterprise: true },
  { feature: "Support",                    free: "Community", starter: "Email",     pro: "Email + chat", agency: "Priority (< 4hr)", enterprise: "Dedicated" },
];

/* ─── FAQ data ─────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: "What happens after my free trial?",
    a: "After 7 days your account is locked — you cannot run new audits, upload new CSVs, or use the AI assistant until you choose a paid plan. Your data is preserved; pick any tier (Starter, Pro, or Agency) and you're back in immediately. No credit card is required to start the trial.",
  },
  {
    q: "Why pay for this instead of just using Claude or ChatGPT?",
    a: "Because deterministic numbers matter. The audit engine computes every dollar figure in code — same CSV in, same number out. LLMs hallucinate math; you can't put a wrong $3,200-wasted figure in front of a client. The AI assistant inside the tool IS Claude, but with your audit data pre-loaded and scoped — you get Claude's intelligence on top of numbers you can defend.",
  },
  {
    q: "What's the difference between Starter and Pro?",
    a: "Starter ($49/mo) gives one solo consultant one client account with the full analysis suite. Pro ($99/mo) supports up to 5 client accounts and adds placement / device breakdowns and weekly trend tracking — designed for someone running multiple campaigns or a small in-house team.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. You can upgrade or downgrade at any time from the Billing page in your admin panel. Upgrades take effect immediately. Downgrades take effect at the end of your current billing cycle.",
  },
  {
    q: "What's included in white-label branding?",
    a: "White-label lets you replace all Blank Page Audits branding with your own. Upload your agency logo, set your brand colors and background, and generate client-facing PDF reports and dashboards that look entirely like your product. Agency tier and above.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Use the Monthly / Annual toggle above to see annual pricing. You save roughly 20% on Starter, Pro, and Agency plans when billed annually.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover) through Stripe. Enterprise customers can also pay via invoice and bank transfer.",
  },
  {
    q: "What is your refund policy?",
    a: "All sales are final. No refunds will be issued under any circumstances. You have a full 7-day free trial to evaluate the platform before committing to a paid plan. If you decide to cancel, you can do so at any time from your billing settings — your subscription will remain active through the end of the current billing period, and you will not be charged again.",
  },
];

/* ─── helper components ────────────────────────────────────────────────── */

function ComparisonCell({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check className="h-4 w-4 text-[var(--red)] mx-auto" />;
  }
  if (value === false) {
    return <Minus className="h-4 w-4 text-[var(--text-dim)] opacity-30 mx-auto" />;
  }
  if (value === "Soon") {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">
        Soon
      </span>
    );
  }
  return (
    <span className="text-xs font-mono text-[var(--text-dim)]">{value}</span>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-[var(--border)] last:border-b-0">
      <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-sm font-semibold select-none list-none [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-[var(--text-dim)]">{a}</p>
    </details>
  );
}

/* ─── Tier icon badge (rendered above each PricingCard) ─────────────── */

function TierBadge({
  Icon,
  label,
  highlighted,
}: {
  Icon: typeof Zap;
  label: string;
  highlighted: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-1">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
          highlighted
            ? "border-[var(--red)]/30 bg-[var(--red-dim)]"
            : "border-[var(--border)] bg-[var(--card)]"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            highlighted ? "text-[var(--red)]" : "text-[var(--text-dim)]"
          }`}
        />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)] font-semibold sr-only">
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "Pricing — Blank Page Audits",
  description:
    "Forensic Meta Ads audits starting at $49/mo. Compare Free, Starter, Pro, Agency, and Enterprise plans. Stop bleeding ad spend.",
};

export default function PricingPage() {
  return (
    <main id="main-content" className="min-h-screen p-6 sm:p-12 lg:p-16">
      <div className="max-w-7xl mx-auto">

        {/* ── Hero ────────────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-4">
            &gt; Blank Page Audits / Pricing
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Stop bleeding ad spend.
            <br />
            <span className="text-[var(--red)]">Start with a forensic audit.</span>
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-dim)] max-w-2xl mx-auto leading-relaxed">
            One CSV drop. Funnel leakage, geographic waste, creative deadweight,
            tracking failures — quantified to the dollar. Pick a plan and start
            auditing in under 2 minutes. Cancel anytime.
          </p>
        </div>

        {/* ── Billing toggle + Pricing cards ──────────────────── */}
        <BillingProvider>
        <BillingToggle />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLANS.map((p) => (
            <div key={p.plan} className="relative flex flex-col">
              {/* "Most Popular" badge */}
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-[var(--red)] text-white font-mono text-[9px] uppercase tracking-widest px-4 py-1 whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Tier icon */}
              <TierBadge Icon={p.icon} label={p.name} highlighted={p.highlighted} />

              {/* PricingCard handles layout + checkout logic */}
              <PricingCard
                plan={p.plan}
                name={p.name}
                price={p.price}
                annualPrice={p.annualPrice}
                period={p.period}
                description={p.description}
                features={p.features}
                cta={p.cta}
                highlighted={p.highlighted}
              />
            </div>
          ))}

          {/* ── Enterprise card (contact sales — no Stripe) ──── */}
          <div className="relative flex flex-col">
            <TierBadge Icon={Building2} label="Enterprise" highlighted={false} />
            <div className="panel flex flex-col flex-1">
              <div className="panel-label">Enterprise</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className="text-4xl font-bold"
                  style={{ fontFamily: "var(--font-head)" }}
                >
                  Custom
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)] mt-3">
                For large organizations needing API access, SSO, SLA guarantees,
                and a dedicated account team.
              </p>
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-[var(--red)] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:sales@blankpageaudits.app?subject=Enterprise%20inquiry"
                className="mt-6 w-full inline-block text-center border border-[var(--border)] hover:border-[var(--red)] hover:text-[var(--red)] font-mono text-xs uppercase tracking-widest py-3 transition-colors"
              >
                Contact sales
              </a>
            </div>
          </div>
        </div>
        </BillingProvider>

        {/* ── No-refund disclaimer ──────────────────────────────── */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--text-dim)] opacity-60">
            All sales are final. No refunds. Cancel anytime — you won&apos;t be charged again.
          </p>
        </div>

        {/* ── Compare all features ───────────────────────────────── */}
        <div className="mt-24">
          <div className="text-center mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-3">
              &gt; Feature comparison
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              Compare all features
            </h2>
          </div>

          <div className="panel overflow-x-auto">
            <table className="data-table w-full min-w-[720px]">
              <caption className="sr-only">Feature comparison across all plans</caption>
              <thead>
                <tr>
                  <th className="text-left w-[32%]">Feature</th>
                  <th className="text-center w-[12%]">Free Trial</th>
                  <th className="text-center w-[12%]">Starter</th>
                  <th className="text-center w-[12%]">
                    <span className="text-[var(--red)]">Pro</span>
                  </th>
                  <th className="text-center w-[16%]">Agency</th>
                  <th className="text-center w-[16%]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="hover:bg-[var(--text)]/[0.04] transition-colors">
                    <td className="text-sm">{row.feature}</td>
                    <td className="text-center">
                      <ComparisonCell value={row.free} />
                    </td>
                    <td className="text-center">
                      <ComparisonCell value={row.starter} />
                    </td>
                    <td className="text-center">
                      <ComparisonCell value={row.pro} />
                    </td>
                    <td className="text-center">
                      <ComparisonCell value={row.agency} />
                    </td>
                    <td className="text-center">
                      <ComparisonCell value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-3">
              &gt; Frequently asked questions
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              Got questions?
            </h2>
          </div>

          <div className="panel">
            {FAQ.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ──────────────────────────────────────────── */}
        <div className="mt-24 text-center pb-8">
          <div className="panel max-w-2xl mx-auto py-12">
            <h3
              className="text-xl sm:text-2xl font-bold tracking-tight mb-3"
              style={{ fontFamily: "var(--font-head)" }}
            >
              Ready to stop wasting ad spend?
            </h3>
            <p className="text-sm text-[var(--text-dim)] mb-6 max-w-md mx-auto">
              Start your 7-day free trial today. No credit card required.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-8 py-3 hover:opacity-90 transition-opacity"
            >
              <Zap className="h-3.5 w-3.5" />
              Start free trial
            </Link>
          </div>

          <div className="mt-8 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--text)] hover:text-[var(--red)]">
              Sign in &rarr;
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
