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
import benchmarksData from "@/data/benchmarks.json";
import { getVisibleClientBySlug, listClientCsvs, getAgencyById } from "@/lib/access";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ client: string }>;
  searchParams: Promise<{ cpl?: string; ctr?: string; industry?: string; days?: string }>;
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

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { client: clientSlug } = await params;
  const search = await searchParams;

  // Auth + access gate.
  const dbClient = await getVisibleClientBySlug(clientSlug);

  const fsCsvDir = path.join(process.cwd(), "public", "csvs", clientSlug);
  const fsExists = fs.existsSync(fsCsvDir);

  // If neither DB nor filesystem has data, 404.
  if (!dbClient && !fsExists) {
    notFound();
  }

  const csvFilesInDb = dbClient ? await listClientCsvs(dbClient.id) : [];
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
  if (dbClient) {
    const agency = await getAgencyById(dbClient.agencyId);
    agencyLogo = agency?.logoUrl ?? findAsset(path.join(process.cwd(), "public", "logos"), "agency");
  } else {
    agencyLogo = findAsset(path.join(process.cwd(), "public", "logos"), "agency");
  }
  const clientLogo = dbClient?.logoUrl ?? (fsExists ? findAsset(fsCsvDir, "logo") : null);

  // Resolve benchmarks.
  type IndustryBench = { label?: string; targetCpl: number; targetCtr: number };
  const benchmarksTyped = benchmarksData as unknown as {
    default: IndustryBench;
    industries: Record<string, IndustryBench>;
  };
  const industry = search.industry ?? clientIndustry ?? "roofing";
  const base = benchmarksTyped.industries[industry] ?? benchmarksTyped.default;
  const benchmarks = {
    targetCpl: search.cpl ? Number(search.cpl) : base.targetCpl,
    targetCtr: search.ctr ? Number(search.ctr) : base.targetCtr,
  };

  const daysFilter = search.days ? Number(search.days) : undefined;

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
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-4">
          <div className="text-5xl">📂</div>
          <h1 className="text-2xl font-bold">No data — upload CSVs to populate</h1>
          <p className="text-gray-400">
            No Meta Ads Manager CSV exports were found for{" "}
            <span className="text-white font-mono">{clientName}</span>.
          </p>
          <p className="text-gray-500 text-sm">
            {dbClient
              ? "Upload the five Meta exports (campaigns, ads, breakdown_age_gender, breakdown_placement, breakdowns) on the client's admin page."
              : `Drop your exports in /public/csvs/${clientSlug}/ or create the client through /admin/clients.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuditDashboard
      audit={audit}
      clientSlug={clientSlug}
      clientSubtitle={clientSubtitle}
      agencyLogo={agencyLogo ?? undefined}
      clientLogo={clientLogo ?? undefined}
      industry={industry}
      industryOptions={industryOptions}
    />
  );
}
