/**
 * /audit/[client] — Server Component (auth-gated, multi-tenant).
 *
 * Data resolution order:
 *   1. Look up Client by slug in DB (and check session user can see it).
 *   2. If the Client has csv_files rows uploaded, run audit from DB content.
 *   3. Otherwise fall back to on-disk CSVs at public/csvs/[slug]/ — this is
 *      how the take-charge-roofing baseline (Tier 0 / Tier 1 dataset) still
 *      reconciles to $3,137.11 / 31 leads without re-uploading.
 *
 * ─── Deploy-safe guard (Tier 3-deploy-safe) ────────────────────────────────
 * All DB-touching calls (`getVisibleClientBySlug`, `listClientCsvs`,
 * `getAgencyById`) are wrapped in try/catch. When AUTH_SECRET / DATABASE_URL
 * are unset the helpers in `lib/access.ts` already short-circuit to null/[],
 * but the try/catch is a belt-and-suspenders net for unexpected runtime
 * errors (e.g. transient libsql failure on Vercel cold start). On any DB
 * error we silently fall through to the filesystem path so the audit
 * dashboard still renders.
 *
 * Notes:
 *   - The legacy engine.runAudit (filesystem) is preserved untouched.
 *   - The DB path uses engine.runAuditFromFiles (Tier 3-only sibling).
 *   - Client display name comes from the DB record, falling back to the
 *     legacy public/csvs/<slug>/client.json (kept for back-compat).
 */
import { notFound } from "next/navigation";
import path from "node:path";
import fs from "node:fs";
import { runAudit } from "@/engine/runAudit";
import { runAuditFromFiles } from "@/engine/runAuditFromFiles";
import AuditDashboard from "./AuditDashboard";
import BrandTheme from "@/components/BrandTheme";
import benchmarksData from "@/data/benchmarks.json";
import { getVisibleClientBySlug, listClientCsvs, getAgencyById } from "@/lib/access";
import { SLUG_RE, getBillingState, countMonthlyAudits, logAuditRun } from "@/lib/billing-access";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ cpl?: string; ctr?: string; industry?: string; days?: string; print?: string }>;
}

function prettyClient(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function findAsset(dir: string, base: string): string | null {
  for (const ext of ["svg", "png", "jpg", "webp"]) {
    const abs = path.join(dir, `${base}.${ext}`);
    if (fs.existsSync(abs)) return abs.replace(path.join(process.cwd(), "public"), "");
  }
  return null;
}

/** Safely call a DB-backed access helper. Any failure → null. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[audit/[client]] DB call failed; falling back to FS:", err);
    return null;
  }
}

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { client: clientSlugRaw } = await params;
  const search = await searchParams;

  // H-2 fix: validate the URL slug BEFORE letting it near the
  // filesystem. Without this, /audit/..%2F..%2Fetc lets the engine
  // probe arbitrary directories via fs.existsSync / fs.readdirSync.
  if (!SLUG_RE.test(clientSlugRaw)) {
    notFound();
  }
  const clientSlug = clientSlugRaw;

  // Auth + access gate. Falls through to FS path when DB/auth unavailable.
  const dbClient = await safe(() => getVisibleClientBySlug(clientSlug));

  const fsCsvDir = path.join(process.cwd(), "public", "csvs", clientSlug);
  // M-23 fix: belt-and-suspenders — path.join must resolve back inside
  // public/csvs even after the regex check.
  const csvsRoot = path.join(process.cwd(), "public", "csvs");
  if (!fsCsvDir.startsWith(csvsRoot + path.sep) && fsCsvDir !== csvsRoot) {
    notFound();
  }
  const fsExists = fs.existsSync(fsCsvDir);

  // If neither DB nor filesystem has data, 404.
  if (!dbClient && !fsExists) {
    notFound();
  }

  const csvFilesInDb = dbClient ? ((await safe(() => listClientCsvs(dbClient.id))) ?? []) : [];
  const useDb = csvFilesInDb.length > 0;

  // Resolve display name / subtitle / industry — DB first, then on-disk client.json fallback.
  let clientName = dbClient?.name ?? prettyClient(clientSlug);
  let clientSubtitle: string | undefined = dbClient?.subtitle ?? undefined;
  let clientIndustry = dbClient?.industry ?? "roofing";

  if (!dbClient && fsExists) {
    const configPath = path.join(fsCsvDir, "client.json");
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
          displayName?: string; subtitle?: string; industry?: string;
        };
        if (cfg.displayName) clientName = cfg.displayName;
        if (cfg.subtitle) clientSubtitle = cfg.subtitle;
        if (cfg.industry) clientIndustry = cfg.industry;
      } catch { /* ignore */ }
    }
  }

  // Resolve logos. Agency logo: DB-driven if dbClient exists, else /public/logos/agency.*.
  // Client logo: DB logoUrl wins; else on-disk public/csvs/<slug>/logo.*.
  let agencyLogo: string | null = null;
  let agencyPrimaryColor: string | null = null;
  let agencySecondaryColor: string | null = null;
  let agencyAccentColor: string | null = null;
  let agencyHighlightColor: string | null = null;
  let agencyPopColor: string | null = null;
  let agencyBgColor: string | null = null;
  let agencyCardColor: string | null = null;
  let agencyBorderColor: string | null = null;
  let agencyTextColor: string | null = null;
  if (dbClient) {
    const agency = await safe(() => getAgencyById(dbClient.agencyId));
    agencyLogo = agency?.logoUrl ?? findAsset(path.join(process.cwd(), "public", "logos"), "agency");
    agencyPrimaryColor = agency?.primaryColor ?? null;
    agencySecondaryColor = agency?.secondaryColor ?? null;
    agencyAccentColor = agency?.accentColor ?? null;
    agencyHighlightColor = agency?.highlightColor ?? null;
    agencyPopColor = agency?.popColor ?? null;
    agencyBgColor = agency?.bgColor ?? null;
    agencyCardColor = agency?.cardColor ?? null;
    agencyBorderColor = agency?.borderColor ?? null;
    agencyTextColor = agency?.textColor ?? null;
  } else {
    agencyLogo = findAsset(path.join(process.cwd(), "public", "logos"), "agency");
  }
  const clientLogo = dbClient?.logoUrl ?? (fsExists ? findAsset(fsCsvDir, "logo") : null);
  // Light-mode logo variants: look for logo-light.* / agency-light.* alongside the normal file.
  const agencyLogoLight = dbClient
    ? findAsset(path.join(process.cwd(), "public", "logos"), "agency-light")
    : findAsset(path.join(process.cwd(), "public", "logos"), "agency-light");
  const clientLogoLight = fsExists ? findAsset(fsCsvDir, "logo-light") : null;

  // Resolve benchmarks.
  type IndustryBench = { label?: string; targetCpl: number; targetCtr: number };
  const benchmarksTyped = benchmarksData as unknown as {
    default: IndustryBench;
    industries: Record<string, IndustryBench>;
  };
  const industry = search.industry ?? clientIndustry ?? "roofing";
  const base = benchmarksTyped.industries[industry] ?? benchmarksTyped.default;

  /**
   * Parse a positive finite number from a query-string value. \`Number(\"foo\")\` is
   * \`NaN\`, and \`NaN > x\` / \`NaN < x\` are always false — that silently
   * poisoned every benchmark comparison downstream (passing badges flipped
   * green) when a user fed e.g. \`?cpl=foo\` or \`?cpl=-5\`. Return the
   * fallback for anything not a finite positive number.
   */
  function parsePosNum(v: string | undefined, fallback: number): number {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  const benchmarks = {
    targetCpl: parsePosNum(search.cpl, base.targetCpl),
    targetCtr: parsePosNum(search.ctr, base.targetCtr),
  };

  // ?days must be a positive integer; anything else (foo, -7, 0, NaN) means
  // "no time-window filter" — the engine treats undefined as the full range.
  function parsePosInt(v: string | undefined): number | undefined {
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : undefined;
  }
  const daysFilter = parsePosInt(search.days);

  // C-6 / C-7: enforce subscription status + monthly audit cap for
  // DB-backed clients. The legacy FS path (take-charge-roofing demo)
  // skips the check so the bundled baseline still renders.
  if (dbClient) {
    const billing = await getBillingState(dbClient.agencyId);
    if (!billing.ok) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-2xl font-bold">Subscription required</h1>
            <p className="text-[var(--text-dim)]">{billing.reason}</p>
            <a
              href="/pricing"
              className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
            >
              View plans →
            </a>
          </div>
        </div>
      );
    }
    const cap = billing.plan.auditsPerMonth;
    if (Number.isFinite(cap)) {
      const used = await countMonthlyAudits(dbClient.agencyId);
      if (used >= cap) {
        return (
          <div className="min-h-screen flex items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-4">
              <div className="text-4xl">📊</div>
              <h1 className="text-2xl font-bold">Monthly audit limit reached</h1>
              <p className="text-[var(--text-dim)]">
                Your {billing.plan.id} plan allows {cap} audit{cap === 1 ? "" : "s"} per month.
                Upgrade for unlimited.
              </p>
              <a
                href="/pricing"
                className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
              >
                Upgrade →
              </a>
            </div>
          </div>
        );
      }
    }
    // Log the run; best-effort.
    void logAuditRun(dbClient.agencyId, dbClient.id);
  }

  const audit = useDb
    ? runAuditFromFiles({
        files: csvFilesInDb.map((c) => ({ filename: c.filename, content: c.content })),
        clientName,
        benchmarks,
        daysFilter,
      })
    : runAudit({
        csvDir: fsCsvDir,
        clientName,
        benchmarks,
        daysFilter,
      });

  const industryOptions = Object.entries(benchmarksTyped.industries).map(
    ([key, v]) => ({ key, label: v.label ?? key }),
  );

  if (audit.fileSummary.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-4">
          <div className="text-5xl">📂</div>
          <h1 className="text-2xl font-bold">No data — upload CSVs to populate</h1>
          <p className="text-[var(--text-dim)]">
            No Meta Ads Manager CSV exports were found for{" "}
            <span className="text-[var(--text)] font-mono">{clientName}</span>.
          </p>
          <p className="text-[var(--text-dim)] text-sm">
            Upload the five Meta exports (campaigns, ads,
            breakdown_age_gender, breakdown_placement, breakdowns) and
            we'll regenerate the audit.
          </p>
          {dbClient && (
            <a
              href={`/admin/clients/${clientSlug}`}
              className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:opacity-90"
            >
              Upload CSVs →
            </a>
          )}
        </div>
      </div>
    );
  }

  const printMode = search.print === "true" || search.print === "1";

  return (
    <>
    <BrandTheme
      primaryColor={agencyPrimaryColor}
      secondaryColor={agencySecondaryColor}
      accentColor={agencyAccentColor}
      highlightColor={agencyHighlightColor}
      popColor={agencyPopColor}
      bgColor={agencyBgColor}
      cardColor={agencyCardColor}
      borderColor={agencyBorderColor}
      textColor={agencyTextColor}
    />
    <AuditDashboard
      audit={audit}
      clientSlug={clientSlug}
      clientSubtitle={clientSubtitle}
      agencyLogo={agencyLogo ?? undefined}
      agencyLogoLight={agencyLogoLight ?? undefined}
      clientLogo={clientLogo ?? undefined}
      clientLogoLight={clientLogoLight ?? undefined}
      industry={industry}
      industryOptions={industryOptions}
      printMode={printMode}
    />
    </>
  );
}
