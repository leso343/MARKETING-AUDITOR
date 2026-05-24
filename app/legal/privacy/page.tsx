import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Blank Page Audits",
  description: "How Blank Page Audits collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen p-6 sm:p-12 lg:p-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
          <Link href="/" className="hover:text-[var(--red)] transition-colors">&gt; Blank Page Audits</Link>
          <span className="text-[var(--border)]"> / </span>
          <span>Privacy Policy</span>
        </div>

        <h1
          className="mb-8 text-3xl font-bold tracking-tight lg:text-4xl"
          style={{ fontFamily: "var(--font-head)" }}
        >
          Privacy Policy
        </h1>

        <p className="mb-4 text-xs font-mono text-[var(--text-dim)]">
          Last updated: May 23, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-dim)]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              1. Information We Collect
            </h2>
            <p>
              When you create an account, we collect your email address, name, and a hashed password.
              When you use our service, we process the Meta Ads Manager CSV files you upload to generate
              audit reports. We also collect standard usage data such as IP addresses, browser type,
              and pages visited.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the audit service</li>
              <li>To process your subscription and billing through Stripe</li>
              <li>To send transactional emails (receipts, account notifications)</li>
              <li>To improve the platform and fix bugs</li>
              <li>To respond to support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              3. Data Storage &amp; Security
            </h2>
            <p>
              Your data is stored on secure cloud infrastructure. CSV files are processed server-side
              and are not shared with third parties. Passwords are hashed using bcrypt. All connections
              use TLS encryption. We retain your uploaded CSV data only for as long as needed to
              generate and display your audit reports.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              4. Third-Party Services
            </h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Stripe</strong> — payment processing. Stripe collects and processes your payment information directly. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--red)] hover:underline">Stripe&apos;s Privacy Policy</a>.</li>
              <li><strong>Vercel</strong> — hosting and infrastructure.</li>
              <li><strong>Turso</strong> — database hosting.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              5. Your Rights
            </h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time
              by contacting us at{" "}
              <a href="mailto:support@blankpageaudits.app" className="text-[var(--red)] hover:underline">
                support@blankpageaudits.app
              </a>
              . You may also delete your account from your admin settings, which removes all associated data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              6. Cookies
            </h2>
            <p>
              We use essential cookies for authentication (session tokens). We do not use
              tracking cookies or sell your data to advertisers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              7. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. Material changes will be communicated
              via email or an in-app notice. Continued use of the service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text)]" style={{ fontFamily: "var(--font-head)" }}>
              8. Contact
            </h2>
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:support@blankpageaudits.app" className="text-[var(--red)] hover:underline">
                support@blankpageaudits.app
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[var(--border)] pt-6 flex gap-6 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          <Link href="/legal/terms" className="hover:text-[var(--red)] transition-colors">
            Terms of Service
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
