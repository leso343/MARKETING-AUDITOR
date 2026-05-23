import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Blank Page Audits",
  description: "Terms and conditions for using Blank Page Audits.",
};

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen p-6 sm:p-12 lg:p-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
          <Link href="/" className="hover:text-[var(--red)] transition-colors">&gt; Blank Page Audits</Link>
          <span className="text-[var(--border)]"> / </span>
          <span>Terms of Service</span>
        </div>

        <h1
          className="mb-8 text-3xl font-bold tracking-tight lg:text-4xl"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Terms of Service
        </h1>

        <p className="mb-4 text-xs font-mono text-[var(--text-dim)]">
          Last updated: May 23, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-dim)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Blank Page Audits (&quot;the Service&quot;), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the Service. We reserve the
              right to modify these terms at any time. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              2. Description of Service
            </h2>
            <p>
              Blank Page Audits is a forensic advertising audit platform. You upload Meta Ads Manager
              CSV exports, and our engine analyzes them to surface budget leaks, tracking failures,
              geographic waste, and creative performance issues. We provide dashboards and reports
              based on this analysis.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              3. Accounts
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate information when creating an account.</li>
              <li>You are responsible for maintaining the security of your credentials.</li>
              <li>You must notify us immediately of any unauthorized access.</li>
              <li>One person or entity per account. Sharing credentials is prohibited.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              4. Billing &amp; Refund Policy
            </h2>
            <p>
              Paid plans are billed monthly or annually through Stripe. <strong>All sales are final.
              No refunds will be issued under any circumstances.</strong> You have a 14-day free trial
              to evaluate the platform before committing to a paid plan.
            </p>
            <p className="mt-2">
              You may cancel your subscription at any time from your billing settings. Upon cancellation,
              your subscription remains active through the end of the current billing period, after which
              your account reverts to read-only access. You will not be charged again.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              5. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload malicious files or attempt to exploit the system</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code</li>
              <li>Resell or redistribute audit reports without authorization</li>
              <li>Exceed the client or usage limits of your plan</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              6. Data &amp; Privacy
            </h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/legal/privacy" className="text-[var(--red)] hover:underline">
                Privacy Policy
              </Link>
              . You retain ownership of all CSV data you upload. We process it solely to provide
              the audit service and do not sell or share your data with third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              7. Intellectual Property
            </h2>
            <p>
              The Service, including its design, code, algorithms, and branding, is the property of
              Blank Page Audits. You may not copy, modify, or distribute any part of the Service
              without written permission. Audit reports generated from your data are yours to use
              as you see fit.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              8. Limitation of Liability
            </h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable for
              any indirect, incidental, or consequential damages arising from your use of the Service.
              Our total liability shall not exceed the amount you paid us in the 12 months preceding
              the claim. Audit reports are analytical tools, not financial advice.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              9. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation
              of these terms, with or without notice. Upon termination, your right to use the
              Service ceases immediately. Sections 4, 7, 8, and 10 survive termination.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              10. Governing Law
            </h2>
            <p>
              These terms are governed by the laws of the United States. Any disputes shall be
              resolved in the courts of the state where the operator resides.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              11. Contact
            </h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:support@blankpageaudits.com" className="text-[var(--red)] hover:underline">
                support@blankpageaudits.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[var(--border)] pt-6 flex gap-6 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          <Link href="/legal/privacy" className="hover:text-[var(--red)] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/pricing" className="hover:text-[var(--red)] transition-colors">
            Pricing
          </Link>
          <Link href="/" className="hover:text-[var(--red)] transition-colors">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
