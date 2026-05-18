/**
 * Home — Client picker.
 *
 * Single tenant for Phase 2, but the layout already anticipates multi-tenant:
 * each client gets a card linking into `/audit/[client]`. The "+ Add new client"
 * button is stubbed for the multi-tenant future.
 */
import Link from "next/link";
import { Activity, Building2, Plus } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen p-5 sm:p-8 lg:p-16">
      {/* header */}
      <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
            &gt; SNA_Forensic / Active_Audits
          </div>
          <h1
            className="text-3xl font-bold tracking-tight lg:text-4xl"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Forensic Marketing Auditor
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-dim)]">
            Drop a folder of Meta Ads Manager CSVs. The engine surfaces tracking
            failures, funnel leaks, geographic waste, and creative dead weight —
            then quantifies the dollar impact.
          </p>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <div className="pulse" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--red)]">
            Engine: Online
          </span>
        </div>
      </div>

      {/* client grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/audit/take-charge-roofing"
          className="group panel transition-all hover:border-[var(--red)]"
        >
          <div className="mb-5 flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-black">
              <Building2 className="h-5 w-5 text-[var(--red)]" />
            </div>
            <span className="status-pill status-critical">Active</span>
          </div>
          <div className="panel-label">Client_Audit_01</div>
          <h2
            className="mb-2 text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Take Charge Roofing
          </h2>
          <p className="mb-5 text-xs text-[var(--text-dim)]">
            Roofing · Florida · Storm-driven lead gen
          </p>
          <div className="grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
            <Stat label="Campaigns" value="13" />
            <Stat label="Ads" value="48" />
            <Stat label="DMAs" value="7" />
          </div>
          <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors group-hover:text-[var(--red)]">
            <Activity className="h-3 w-3" />
            Open dashboard →
          </div>
        </Link>

        {/* + Add new client (stubbed) */}
        <button
          type="button"
          disabled
          className="panel flex h-full min-h-[260px] cursor-not-allowed flex-col items-center justify-center text-center opacity-40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-dashed border-[var(--border)]">
            <Plus className="h-5 w-5 text-[var(--text-dim)]" />
          </div>
          <div className="text-sm font-semibold text-[var(--text-dim)]">
            Add new client
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Multi-tenant — coming soon
          </div>
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
    </div>
  );
}
