/**
 * Analytics — lightweight, privacy-friendly.
 *
 * Supports two providers (set ONE env var):
 *   - Plausible:        NEXT_PUBLIC_PLAUSIBLE_DOMAIN="blankpageaudits.com"
 *   - Google Analytics: NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
 *
 * When neither is set, this component renders nothing.
 *
 * Add <Analytics /> to app/layout.tsx inside <head>.
 */
import Script from "next/script";

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Analytics() {
  // Plausible — privacy-first, no cookies, GDPR compliant
  if (PLAUSIBLE_DOMAIN) {
    return (
      <Script
        defer
        data-domain={PLAUSIBLE_DOMAIN}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  // Google Analytics
  if (GA_ID) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure',
            });
          `}
        </Script>
      </>
    );
  }

  // No analytics configured
  return null;
}
