"use client";

/**
 * ReportPage — A4-style page wrapper for the forensic-audit executive
 * report. Modeled on the original public/campaign_report.html layout:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ [AGENCY LOGO] ──────red gradient line────── [CLIENT]   │   ← header
 *   │                                                        │
 *   │  {children — hero + sec-titles + cards + charts}       │
 *   │                                                        │
 *   │ {footer chip} ........................... {page X/Y}   │   ← footer
 *   └────────────────────────────────────────────────────────┘
 *      (red 5px bottom border on each page, gradient bg)
 *
 * Renders distinct from the dashboard — narrative, print-friendly,
 * branded. Logos come from the BrandTheme tree props (passed in via
 * ReportViewer), so the agency's actual mark appears top-left and the
 * client's mark top-right.
 */

import type { ReactNode } from "react";

interface ReportPageProps {
  children: ReactNode;
  agencyLogo?: string;
  agencyLogoLight?: string;
  clientName: string;
  clientLogo?: string;
  clientLogoLight?: string;
  /** e.g. "Page 1 / 4" — bottom-right slot. */
  pageLabel?: string;
  /** Left-of-footer text. Defaults to "Forensic Audit · Confidential". */
  footerNote?: string;
}

export default function ReportPage({
  children,
  agencyLogo,
  agencyLogoLight,
  clientName,
  clientLogo,
  clientLogoLight,
  pageLabel,
  footerNote = "Forensic Audit · Confidential",
}: ReportPageProps) {
  // We deliberately don't try to swap dark/light variants at runtime
  // here — the inheriting html.light overrides handle backgrounds via
  // tokens and the logos themselves render fine on either bg color.
  // The *Light variant exists for the dashboard, not the report.
  void agencyLogoLight;
  void clientLogoLight;

  return (
    <article className="report-page">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="report-page__header">
        {agencyLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={agencyLogo} alt="Agency" className="report-page__logo" />
        ) : (
          <div className="report-page__logo-fallback">Blank Page Audits</div>
        )}

        <div className="report-page__line" />

        {clientLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={clientLogo} alt={`${clientName} logo`} className="report-page__logo report-page__logo--right" />
        ) : (
          <div className="report-page__logo-fallback report-page__logo-fallback--right">
            {clientName}
          </div>
        )}
      </header>

      {/* ── Body — caller fills with hero + sections ──────────────── */}
      <div className="report-page__body">{children}</div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="report-page__footer">
        <span>{footerNote}</span>
        {pageLabel && <span>{pageLabel}</span>}
      </footer>
    </article>
  );
}
