"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Crosshair,
  ExternalLink,
  FileBarChart,
  MapPinned,
  Menu,
  PieChart,
  Users,
  X,
  Sliders,
  Calendar,
  Layers,
} from "lucide-react";
import { useLang } from "@/context/LangContext";
interface Props {
  clientName: string;
  clientSubtitle?: string;
  primaryLeak: string;
  clientSlug?: string;
  agencyLogo?: string;
  clientLogo?: string;
}

function AgencyLogoSVG({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-black text-white leading-none" style={{ fontFamily: "var(--font-head)", letterSpacing: -1 }}>SNA</span>
        <span className="inline-block w-[4px] h-[4px] bg-[var(--red)] flex-shrink-0" />
        <span className="font-black text-[var(--red)] uppercase" style={{ fontFamily: "var(--font-head)", fontSize: 9, letterSpacing: 1.5 }}>Forensic</span>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span className="text-2xl font-black text-white leading-none" style={{ fontFamily: "var(--font-head)", letterSpacing: -1.5 }}>SNA</span>
      <span className="inline-block w-[5px] h-[5px] bg-[var(--red)] mb-[3px] flex-shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="font-black text-white uppercase" style={{ fontFamily: "var(--font-head)", fontSize: 8, letterSpacing: 2 }}>FORENSIC</span>
        <span className="text-[#9CA3AF] uppercase" style={{ fontFamily: "var(--font-mono)", fontSize: 6, letterSpacing: 1.5 }}>MARKETING ENGINE</span>
      </div>
    </div>
  );
}

function ClientLogoSVG({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <div>
      <div className="mb-0.5">
        <span
          className="inline-block border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[2px] text-[var(--red)]"
          style={{ borderColor: "rgba(220,38,38,0.4)", background: "rgba(220,38,38,0.08)" }}
        >
          CLIENT
        </span>
      </div>
      <div className="font-black text-white leading-tight" style={{ fontFamily: "var(--font-head)", fontSize: 14, letterSpacing: 0.2 }}>
        {name.toUpperCase()}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[#9CA3AF] uppercase" style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ clientName, clientSubtitle, primaryLeak, clientSlug, agencyLogo, clientLogo }: Props) {
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups = [
    {
      label: t("Diagnostic", "What we found"),
      items: [
        { href: "#overview", label: t("Executive Summary", "Top Findings"), icon: FileBarChart },
        { href: "#leakage", label: t("Funnel Integrity", "Customer Drop-Off"), icon: Activity },
        { href: "#tracking", label: t("Sentinel Audit", "Is tracking broken?"), icon: AlertTriangle },
      ],
    },
    {
      label: t("Market Segments", "Who saw the ads"),
      items: [
        { href: "#geo", label: t("Geographic Sieve", "Cities & areas"), icon: MapPinned },
        { href: "#creative", label: t("Creative Drill", "How each ad did"), icon: Users },
        { href: "#demographics", label: t("Demographics", "Age & gender"), icon: PieChart },
      ],
    },
    {
      label: t("What-If Explorers", "Try It Yourself"),
      items: [
        { href: "#funnel-explorer", label: t("Funnel Explorer", "Drop-Off Explorer"), icon: Sliders },
        { href: "#weekly-scrubber", label: t("Weekly CPL Scrubber", "Cost Over Time"), icon: Calendar },
        { href: "#geo-reallocator", label: t("Budget Reallocator", "Move Money Around"), icon: Layers },
      ],
    },
    {
      label: t("Protocol", "What to do next"),
      items: [
        { href: "#plan", label: t("30-Day Fix Queue", "Fix list (30 days)"), icon: Crosshair },
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

      {/* Agency logo */}
      <div className="mb-10 flex justify-center">
        {agencyLogo ? (
          <img src={agencyLogo} alt="Agency" className="h-28 w-auto max-w-[210px] object-contain" />
        ) : (
          <AgencyLogoSVG />
        )}
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
        {/* Client logo block */}
        <div className="mb-4 flex justify-center">
          {clientLogo ? (
            <img src={clientLogo} alt={clientName} className="h-32 w-auto max-w-[210px] object-contain" />
          ) : (
            <ClientLogoSVG name={clientName} subtitle={clientSubtitle} />
          )}
        </div>
        <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--red)]">
          {t("Primary leak", "Biggest problem")}
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

      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar — visible below lg */}
      <div
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 lg:hidden"
        style={{ background: "var(--sidebar)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center">
          {agencyLogo ? (
            <img src={agencyLogo} alt="Agency" className="h-8 w-auto object-contain" />
          ) : (
            <AgencyLogoSVG compact />
          )}
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

      {/* Desktop sidebar — hidden on mobile, scrollable */}
      <aside
        className="hidden w-[260px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] px-6 py-9 lg:flex lg:flex-col overflow-y-auto"
        style={{ height: "100vh", position: "sticky", top: 0, scrollbarWidth: "thin", scrollbarColor: "var(--red) var(--bg)" }}
      >
        {navContent}
      </aside>
    </>
  );
}
