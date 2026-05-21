import Link from "next/link";
import { requireUser } from "@/lib/access";
import { authEnabled } from "@/auth";
import { dbAvailable } from "@/lib/db";
import { redirect } from "next/navigation";

/**
 * Admin shell.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset OR DB is unavailable, multi-tenant admin makes
 * no sense — render a clear notice instead of redirecting (which used to
 * loop to /login). The user can still reach the audits via "/" in legacy
 * filesystem mode.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!authEnabled || !dbAvailable) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="max-w-lg w-full panel space-y-4 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
            &gt; Admin disabled
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
            Multi-tenant mode disabled
          </h1>
          <p className="text-sm text-[var(--text-dim)]">
            Multi-tenant admin requires both <code>AUTH_SECRET</code> and{" "}
            <code>DATABASE_URL</code> to be configured.{" "}
            {!authEnabled && !dbAvailable
              ? "Neither is set — the app is running in legacy single-tenant filesystem mode."
              : !authEnabled
              ? "AUTH_SECRET is not set."
              : "DATABASE_URL is not set."}
          </p>
          <p className="text-xs text-[var(--text-dim)]">
            See <code>TIER-3-DEPLOY-SAFE-CHANGES.md</code> for the full guard
            list and how to enable multi-tenant features.
          </p>
          <Link
            href="/"
            className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const user = await requireUser();
  // agency users can manage their own clients; admins can do everything.
  if (user.role !== "admin" && user.role !== "agency") redirect("/");
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] hover:text-white">
            &lt; Back to dashboard
          </Link>
          <Link href="/admin/clients" className="text-sm hover:text-[var(--red)]">Clients</Link>
          {user.role === "admin" && (
            <Link href="/admin/agencies" className="text-sm hover:text-[var(--red)]">Agencies</Link>
          )}
          <Link href="/admin/settings" className="text-sm hover:text-[var(--red)]">Settings</Link>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          {user.email} · {user.role}
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
