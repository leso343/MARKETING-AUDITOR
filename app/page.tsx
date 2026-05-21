/**
 * Home — client picker, agency-scoped.
 *
 * Replaces the previous hardcoded "Take Charge Roofing" tile with a DB-driven
 * list. Agency users see only their agency's clients; admins see everything.
 * The Tier 2.5 "PDF link" + per-client treatment is the pattern here: nothing
 * in the home page is bound to a specific slug anymore.
 */
import Link from "next/link";
import { Activity, Building2, Plus, Settings2, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { listVisibleClients, getCurrentAgency } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const clients = await listVisibleClients();
  const agency = await getCurrentAgency();
  const isAdmin = session.user.role === "admin";

  const headerLabel = agency?.name ?? "Forensic Marketing Auditor";
  const headerAccent = agency?.primaryColor ?? "var(--red)";

  return (
    <main className="min-h-screen p-5 sm:p-8 lg:p-16">
      {/* header */}
      <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
            &gt; SNA_Forensic / Active_Audits
          </div>
          <div className="flex items-center gap-4">
            {agency?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency.logoUrl} alt={agency.name} className="h-12 w-auto" />
            )}
            <h1
              className="text-3xl font-bold tracking-tight lg:text-4xl"
              style={{ fontFamily: "var(--font-head)", color: agency ? undefined : undefined }}
            >
              {headerLabel}
            </h1>
          </div>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-dim)]">
            Drop a folder of Meta Ads Manager CSVs. The engine surfaces tracking
            failures, funnel leaks, geographic waste, and creative dead weight —
            then quantifies the dollar impact.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <div className="pulse" style={{ background: headerAccent }} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: headerAccent }}>
              Engine: Online
            </span>
          </div>
          {isAdmin && (
            <Link href="/admin/clients" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
              <Settings2 className="h-3 w-3" />
              Admin
            </Link>
          )}
          <Link href="/admin/clients" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
            <Plus className="h-3 w-3" />
            Clients
          </Link>
          <Link href="/pricing" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
            Pricing
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* client grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/audit/${c.slug}`}
            className="group panel transition-all hover:border-[var(--red)]"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-black">
                <Building2 className="h-5 w-5 text-[var(--red)]" />
              </div>
              <span className="status-pill status-critical">Active</span>
            </div>
            <div className="panel-label">{c.slug}</div>
            <h2 className="mb-2 text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>
              {c.name}
            </h2>
            <p className="mb-5 text-xs text-[var(--text-dim)]">
              {c.subtitle ?? (c.industry ? `Industry · ${c.industry}` : "—")}
            </p>
            <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors group-hover:text-[var(--red)]">
              <Activity className="h-3 w-3" />
              Open dashboard →
            </div>
          </Link>
        ))}

        <Link
          href="/admin/clients"
          className="panel flex h-full min-h-[260px] flex-col items-center justify-center text-center hover:border-[var(--red)]"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center border border-dashed border-[var(--border)]">
            <Plus className="h-5 w-5 text-[var(--text-dim)]" />
          </div>
          <div className="text-sm font-semibold">
            Add new client
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Upload CSVs &rarr; audit
          </div>
        </Link>
      </div>
    </main>
  );
}
