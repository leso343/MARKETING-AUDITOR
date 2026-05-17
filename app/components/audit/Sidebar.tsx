"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Crosshair,
  FileBarChart,
  MapPinned,
  Users,
} from "lucide-react";

interface Props {
  clientName: string;
  primaryLeak: string;
}

const navGroups: { label: string; items: { href: string; label: string; icon: typeof Activity }[] }[] = [
  {
    label: "Diagnostic",
    items: [
      { href: "#overview", label: "Executive Summary", icon: FileBarChart },
      { href: "#leakage", label: "Funnel Integrity", icon: Activity },
      { href: "#tracking", label: "Sentinel Audit", icon: AlertTriangle },
    ],
  },
  {
    label: "Market Segments",
    items: [
      { href: "#geo", label: "Geographic Sieve", icon: MapPinned },
      { href: "#creative", label: "Creative Drill", icon: Users },
    ],
  },
  {
    label: "Protocol",
    items: [{ href: "#plan", label: "30-Day Fix Queue", icon: Crosshair }],
  },
];

export default function Sidebar({ clientName, primaryLeak }: Props) {
  return (
    <aside
      className="hidden w-[260px] flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-6 py-9 lg:flex"
      style={{ minHeight: "100vh", position: "sticky", top: 0, height: "100vh" }}
    >
      <Link
        href="/"
        className="mb-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:text-white"
      >
        <ChevronLeft className="h-3 w-3" />
        All clients
      </Link>

      <div
        className="mb-10 text-base font-extrabold uppercase tracking-tight text-[var(--red)]"
        style={{ fontFamily: "var(--font-head)" }}
      >
        SNA_FORENSIC
      </div>

      {navGroups.map((g) => (
        <div key={g.label} className="mb-7">
          <div className="mb-4 font-mono text-[9px] uppercase tracking-[2px] text-[#333]">
            {g.label}
          </div>
          {g.items.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
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
          Client
        </div>
        <div className="text-sm font-bold text-white">{clientName}</div>
        <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--red)]">
          Primary leak
        </div>
        <div className="mt-1 text-[11px] leading-snug text-[var(--text-dim)]">
          {primaryLeak}
        </div>
      </div>
    </aside>
  );
}
