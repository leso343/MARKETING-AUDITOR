import type { Metadata } from "next";
import "./globals.css";
import ScrollbarFade from "@/components/ScrollbarFade";
import Analytics from "@/components/Analytics";
import SessionProviderWrapper from "./SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Blank Page Audits — Forensic Ad Intelligence",
  description:
    "Forensic Meta Ads audits that surface budget leaks, funnel gaps, and wasted spend. Upload CSVs, get answers.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://blankpageaudits.com"
  ),
  openGraph: {
    title: "Blank Page Audits — Forensic Ad Intelligence",
    description:
      "Surface budget leaks, funnel gaps, and wasted spend with forensic Meta Ads analysis.",
    siteName: "Blank Page Audits",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blank Page Audits — Forensic Ad Intelligence",
    description:
      "Surface budget leaks, funnel gaps, and wasted spend with forensic Meta Ads analysis.",
  },
};

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#030303" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS_HREF} rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
        <Analytics />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-[var(--red)] focus:text-white focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-widest focus:outline-none"
        >
          Skip to content
        </a>
        <ScrollbarFade />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
