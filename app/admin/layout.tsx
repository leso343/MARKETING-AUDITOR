import Link from "next/link";
import { requireUser } from "@/lib/access";
import { authEnabled } from "@/auth";
import { dbAvailable } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Building2,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Admin shell — polished sidebar-style nav.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset OR DB is unavailable, multi-tenant admin makes
 * no sense — render a clear notice instead of redirecting.
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
  if (user.role !== "admin" && user.role !== "agency") redirect("/");

  const navItems = [
    { href: "/admin/clients", label: "Clients", icon: Building2 },
    ...(user.role === "admin"
      ? [
          { href: "/admin/agencies", label: "Agencies", icon: Shield },
          { href: "/admin/users", label: "Users", icon: Users },
        ]
      : []),
    { href: "/admin/billing", label: "Billing", icon: CreditCard },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen">
      {/* ── top nav bar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex items-center justify-between px-4 sm:px-6">
          {/* left: back + nav links */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-1.5 border-r border-[var(--border)] pr-4 py-3 font-mono text-[10px] uppercase tracking-[2px] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
            <div className="flex items-center">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  <item.icon className="h-3.5 w-3.5 text-[var(--text-dim)] transition-colors group-hover:text-[var(--red)]" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">
                    {item.label}
                  </span>
                  {/* hover underline */}
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] scale-x-0 bg-[var(--red)] transition-transform group-hover:scale-x-100" />
                </Link>
              ))}
            </div>
          </div>

          {/* right: theme toggle + user info */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
                <Shield className="h-3 w-3 text-[var(--red)]" />
              </div>
              <div className="hidden sm:block">
                <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
                  {user.email}
                </div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--red)]">
                  {user.role}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── content area ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
