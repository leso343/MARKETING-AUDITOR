/**
 * Home — client picker, agency-scoped.
 *
 * Replaces the previous hardcoded "Take Charge Roofing" tile with a DB-driven
 * list. Agency users see only their agency's clients; admins see everything.
 * The Tier 2.5 "PDF link" + per-client treatment is the pattern here: nothing
 * in the home page is bound to a specific slug anymore.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * When AUTH_SECRET is unset (single-tenant / legacy mode), or when DB is
 * unavailable, the home renders a filesystem-scanned client list from
 * `public/csvs/<slug>/` directories instead of redirecting to /login. This
 * preserves the original Tier 2/2.5 deployment experience when no env vars
 * are present.
 */
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { Activity, Plus, Settings2, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import OnboardingWizard from "@/components/OnboardingWizard";
import ClientLogo from "@/components/ClientLogo";
import { auth, authEnabled, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { dbAvailable } from "@/lib/db";
import { listVisibleClients, getCurrentAgency } from "@/lib/access";

export const dynamic = "force-dynamic";

type ClientTile = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  industry: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Look for logo.{png,jpg,svg,webp} on disk. Returns public URL or null. */
function findClientLogo(slug: string, prefix = "logo"): string | null {
  const dir = path.join(process.cwd(), "public", "csvs", slug);
  if (!fs.existsSync(dir)) return null;
  for (const ext of ["png", "jpg", "jpeg", "svg", "webp"]) {
    const file = path.join(dir, `${prefix}.${ext}`);
    if (fs.existsSync(file)) return `/csvs/${slug}/${prefix}.${ext}`;
  }
  return null;
}

function prettyClient(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Filesystem-only client list — scans public/csvs/* directories. Used when
 * auth is disabled or DB is unavailable, so the site stays useful in
 * single-tenant (no env vars) deployments.
 */
function scanFsClients(): ClientTile[] {
  const csvsDir = path.join(process.cwd(), "public", "csvs");
  if (!fs.existsSync(csvsDir)) return [];
  const slugs = fs
    .readdirSync(csvsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  return slugs.map((slug) => {
    let name = prettyClient(slug);
    let subtitle: string | null = null;
    let industry: string | null = "roofing";
    const cfgPath = path.join(csvsDir, slug, "client.json");
    if (fs.existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
          displayName?: string;
          subtitle?: string;
          industry?: string;
        };
        if (cfg.displayName) name = cfg.displayName;
        if (cfg.subtitle) subtitle = cfg.subtitle;
        if (cfg.industry) industry = cfg.industry;
      } catch {
        /* ignore malformed client.json */
      }
    }
    const logoUrl = findClientLogo(slug);
    const logoUrlLight = findClientLogo(slug, "logo-light");
    return { id: slug, slug, name, subtitle, industry, logoUrl, logoUrlLight };
  });
}

export default async function Home() {
  // ── Deploy-safe legacy mode: no auth, no DB ───────────────────────────
  if (!authEnabled || !dbAvailable) {
    const clients: ClientTile[] = scanFsClients();
    const headerAccent = "var(--red)";

    return (
      <main id="main-content" className="min-h-screen p-5 sm:p-8 lg:p-16">
        <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
              &gt; Blank Page Audits / Active Audits
            </div>
            <Logo size="lg" />
            <p className="mt-2 max-w-xl text-sm text-[var(--text-dim)]">
              Drop a folder of Meta Ads Manager CSVs. The engine surfaces tracking
              failures, funnel leaks, geographic waste, and creative dead weight —
              then quantifies the dollar impact.
            </p>
            <p className="mt-3 max-w-xl font-mono text-[10px] uppercase tracking-widest text-amber-500/80">
              Legacy mode · multi-tenant features disabled.{" "}
              {!authEnabled ? "Set AUTH_SECRET" : "Set DATABASE_URL"} to enable.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="hidden items-center gap-2 lg:flex">
              <div className="pulse" style={{ background: headerAccent }} />
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: headerAccent }}
              >
                Engine: Online
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/audit/${c.slug}`}
              className="group panel transition-all hover:border-[var(--red)]"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <ClientLogo name={c.name} logoUrl={c.logoUrl} logoUrlLight={c.logoUrlLight} />
                </div>
                <span className="status-pill status-critical">Active</span>
              </div>
              <div className="panel-label">{c.slug}</div>
              <h2
                className="mb-2 text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-head)" }}
              >
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
          {clients.length === 0 && (
            <div className="panel col-span-full text-sm text-[var(--text-dim)]">
              No clients found under <code>public/csvs/</code>. Drop a Meta Ads
              CSV bundle into <code>public/csvs/&lt;slug&gt;/</code> and refresh.
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Full multi-tenant flow (AUTH_SECRET + DATABASE_URL both set) ──────
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rawClients = await listVisibleClients();
  // Resolve logos for each client: DB → on-disk fallback
  const clients = rawClients.map((c) => ({
    ...c,
    logoUrl: c.logoUrl ?? findClientLogo(c.slug),
    logoUrlLight: c.logoUrlLight ?? findClientLogo(c.slug, "logo-light"),
  }));
  const agency = await getCurrentAgency();
  const isAdmin = session.user.role === "admin";

  const headerAccent = agency?.primaryColor ?? "var(--red)";

  // Dynamic import to avoid pulling BrandTheme into the legacy FS path
  const BrandTheme = (await import("@/components/BrandTheme")).default;

  return (
    <main id="main-content" className="min-h-screen p-5 sm:p-8 lg:p-16">
      <BrandTheme
        primaryColor={agency?.primaryColor}
        secondaryColor={agency?.secondaryColor}
        accentColor={agency?.accentColor}
        highlightColor={agency?.highlightColor}
        popColor={agency?.popColor}
      />
      {/* header */}
      <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)]">
            &gt; Blank Page Audits / Active Audits
          </div>
          {agency?.logoUrl ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={agency.logoUrl} alt={agency.name} className="h-12 w-auto" />
              <h1
                className="text-3xl font-bold tracking-tight lg:text-4xl"
                style={{ fontFamily: "var(--font-head)" }}
              >
                {agency.name}
              </h1>
            </div>
          ) : (
            <Logo size="lg" />
          )}
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
          <NotificationBell />
          <ThemeToggle />
          {isAdmin && (
            <Link href="/admin/clients" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
              <Settings2 className="h-3 w-3" />
              Admin
            </Link>
          )}
          {!isAdmin && session.user.role === "agency" && (
            <Link href="/admin/clients" className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]">
              <Plus className="h-3 w-3" />
              Clients
            </Link>
          )}
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

      {/* Onboarding wizard — shown when user has no clients */}
      {clients.length === 0 && <OnboardingWizard />}

      {/* client grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/audit/${c.slug}`}
            className="group panel transition-all hover:border-[var(--red)]"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                <ClientLogo name={c.name} logoUrl={c.logoUrl} logoUrlLight={c.logoUrlLight} />
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
