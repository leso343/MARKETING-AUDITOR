"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Crosshair,
  Download,
  ExternalLink,
  FileBarChart,
  MapPinned,
  Menu,
  PieChart,
  Users,
  X,
} from "lucide-react";
import { useLang } from "@/context/LangContext";

interface Props {
  clientName: string;
  primaryLeak: string;
  pdfPath?: string;
}

export default function Sidebar({ clientName, primaryLeak, pdfPath }: Props) {
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups = [
    {
      label: t("Diagnostic", "Analysis"),
      items: [
        { href: "#overview", label: t("Executive Summary", "Top Findings"), icon: FileBarChart },
        { href: "#leakage", label: t("Funnel Integrity", "Customer Drop-Off"), icon: Activity },
        { href: "#tracking", label: t("Sentinel Audit", "Tracking Check"), icon: AlertTriangle },
      ],
    },
    {
      label: t("Market Segments", "Audience & Creative"),
      items: [
        { href: "#geo", label: t("Geographic Sieve", "Location Data"), icon: MapPinned },
        { href: "#creative", label: t("Creative Drill", "Ad Performance"), icon: Users },
        { href: "#demographics", label: t("Demographics", "Age Breakdown"), icon: PieChart },
      ],
    },
    {
      label: t("Protocol", "Action Plan"),
      items: [
        { href: "#plan", label: t("30-Day Fix Queue", "Action Items"), icon: Crosshair },
      ],
    },
  ];

  const navContent = (
    <>
      <Link
        href="/"
        className="mb-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:text-white"
        onClick={() => setMobileOpen(false)}
      >
        <ChevronLeft className="h-3 w-3" />
        {t("All clients", "All clients")}
      </Link>

      <div
        className="mb-10 text-base font-extrabold uppercase tracking-tight text-[var(--red)]"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("SNA_FORENSIC", "SNA Forensic")}
      </div>

      {navGroups.map((g) => (
        <div key={g.label} className="mb-7">
          <div className="mb-4 font-mono text-[9px] uppercase tracking-[2px] text-[#666]">
            {g.label}
          </div>
          {g.items.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="mb-1 flex items-center gap-3 rounded px-3 py-2.5 text-[13px] font-medium text-[var(--text-dim)] transition-colors hover:bg-white/[0.03] hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </a>
            );
          })}
        </div>
      ))}

      <div className="mt-auto border-t border-[var(--border)] pt-5">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
          {t("Client", "Client")}
        </div>
        <div className="text-sm font-bold text-white">{clientName}</div>
        <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--red)]">
          {t("Primary leak", "Biggest issue")}
        </div>
        <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-[var(--text-dim)]">
          {primaryLeak}
        </div>

        {/* Full interactive campaign report — opens in new tab */}
        <a
          href="/campaign_report.html"
          target="_blank"
          rel="noopener"
          className="mt-5 flex items-center gap-2 border border-[var(--red-dim)] bg-[rgba(255,0,0,0.04)] px-3 py-2.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] transition-colors hover:border-[var(--red)] hover:bg-[rgba(255,0,0,0.08)]"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          {t("Interactive Report", "Interactive Report")}
        </a>

        {pdfPath && (
          <a
            href={pdfPath}
            download
            className="mt-2 flex items-center gap-2 border border-[var(--border)] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-white hover:text-white"
          >
            <Download className="h-3 w-3 flex-shrink-0" />
            {t("Download PDF Report", "Download PDF Report")}
          </a>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — visible below lg */}
      <div
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 lg:hidden"
        style={{ background: "rgba(6,6,6,0.97)", backdropFilter: "blur(8px)" }}
      >
        <div
          className="text-sm font-extrabold uppercase tracking-tight text-[var(--red)]"
          style={{ fontFamily: "var(--font-head)" }}
        >
          {t("SNA_FORENSIC", "SNA Forensic")}
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:text-white"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 flex lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="flex w-72 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar)] px-6 pb-9 pt-20"
            style={{ minHeight: "100vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </div>
          {/* backdrop */}
          <div className="flex-1 bg-black/60" />
        </div>
      )}

      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className="hidden w-[260px] flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-6 py-9 lg:flex"
        style={{ minHeight: "100vh", position: "sticky", top: 0, height: "100vh" }}
      >
        {navContent}
      </aside>
    </>
  );
}
