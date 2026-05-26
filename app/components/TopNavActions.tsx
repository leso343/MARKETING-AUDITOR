"use client";

/**
 * TopNavActions — the right-hand button cluster that should be reachable
 * from anywhere on the site (notifications, theme toggle, admin shortcut,
 * pricing, sign out, engine-status indicator).
 *
 * Used in:
 *   - app/page.tsx (dashboard)              — sticky header
 *   - app/audit/[client]/AuditDashboard.tsx — sticky audit header
 *   - app/admin/layout.tsx                  — sticky admin nav
 *
 * Designed to slot into an existing sticky header rather than be one
 * itself, so each page keeps its own title/context on the left side.
 *
 * Reads `useSession()` from next-auth/react so any page rendering this
 * gets the correct admin/signout state without having to pass it as a
 * prop. Falls back gracefully to a signed-out view when no session
 * provider is present (legacy single-tenant mode).
 *
 * Variants control which buttons render:
 *   - "full"     : engine + bell + theme + admin + pricing + signout
 *   - "compact"  : bell + theme + admin + pricing + signout (no engine)
 *   - "admin"    : engine + bell + theme + pricing + signout (admin
 *                  link hidden, since you're already in admin)
 */
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Settings2, LogOut, DollarSign } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

export type TopNavVariant = "full" | "compact" | "admin";

interface Props {
  variant?: TopNavVariant;
  /** Optional engine-status accent color (defaults to var(--red)). */
  engineAccent?: string;
}

export default function TopNavActions({
  variant = "full",
  engineAccent = "var(--red)",
}: Props) {
  // useSession returns { data: null } when no provider is present, so
  // this is safe to call from anywhere — including legacy mode pages.
  const { data: session } = useSession();
  const userRole = (session?.user?.role as "admin" | "agency" | undefined) ?? null;
  const signedIn = userRole != null;

  const showEngine = variant === "full" || variant === "admin";
  const showAdminLink = variant !== "admin" && signedIn;

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
      {showEngine && (
        <div className="hidden items-center gap-2 lg:flex">
          <div
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: engineAccent, boxShadow: `0 0 8px ${engineAccent}` }}
          />
          <span
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: engineAccent }}
          >
            Engine: Online
          </span>
        </div>
      )}

      {signedIn && <NotificationBell />}
      <ThemeToggle />

      {showAdminLink && (
        <Link
          href="/admin/clients"
          className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
          title="Open admin panel"
        >
          <Settings2 className="h-3 w-3" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}

      <Link
        href="/pricing"
        className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
        title="View pricing plans"
      >
        <DollarSign className="h-3 w-3" />
        <span className="hidden sm:inline">Pricing</span>
      </Link>

      {signedIn ? (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
          title="Sign out of your account"
        >
          <LogOut className="h-3 w-3" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--red)] text-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-all hover:opacity-90"
          title="Sign in to your account"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
