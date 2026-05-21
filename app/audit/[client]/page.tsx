/**
 * /audit/[client] — Server Component
 *
 * Reads CSVs from /public/csvs/[client]/ on each request, runs the engine, and
 * hands the result to the client-side dashboard. Dev mode hot-reloads on
 * code changes; CSV changes are picked up on the next request (full reload).
 */
import { notFound } from "next/navigation";
import path from "node:path";
import fs from "node:fs";
import { runAudit } from "@/engine/runAudit";
import AuditDashboard from "./AuditDashboard";
import benchmarksData from "@/data/benchmarks.json";

// Disable static caching — we want this to re-run on every nav.
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

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { client } = await params;
  const search = await searchParams;

  const csvDir = path.join(process.cwd(), "public", "csvs", client);
  if (!fs.existsSync(csvDir)) {
    notFound();
  }

  // Read optional per-client config (displayName, subtitle, industry)
  let clientConfig: { displayName?: string; subtitle?: string; industry?: string } = {};
  const configPath = path.join(csvDir, "client.json");
  if (fs.existsSync(configPath)) {
    try { clientConfig = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { /* ignore */ }
  }

  // Resolve logo paths (served as /logos/... or /csvs/[client]/...)
  const agencyLogo = findAsset(path.join(process.cwd(), "public", "logos"), "agency");
  const clientLogo = findAsset(csvDir, "logo");

  // Resolve benchmarks: ?industry overrides default; ?cpl / ?ctr override either.
  type IndustryBench = {
    label?: string;
    targetCpl: number;
    targetCtr: number;
  };
  const benchmarksTyped = benchmarksData as unknown as {
    default: IndustryBench;
    industries: Record<string, IndustryBench>;
  };
  const industry = search.industry ?? "roofing";
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

  const audit = runAudit({
    csvDir,
    clientName: prettyClient(client),
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
          <h1 className="text-2xl font-bold">No data — drop CSVs to populate</h1>
          <p className="text-gray-400">
            No Meta Ads Manager CSV exports were found for{" "}
            <span className="text-white font-mono">{prettyClient(client)}</span>.
          </p>
          <p className="text-gray-500 text-sm font-mono bg-gray-900 rounded p-3">
            /public/csvs/{client}/
          </p>
          <p className="text-gray-400 text-sm">
            Drop your exports there (campaigns.csv, ads.csv, breakdowns.csv) and
            reload. The engine picks up any .csv file in that folder automatically.
          </p>
        </div>
      </div>
    );
  }

  const printMode = search.print === "true" || search.print === "1";

  return (
    <AuditDashboard
      audit={audit}
      clientSlug={client}
      clientSubtitle={clientConfig.subtitle}
      agencyLogo={agencyLogo ?? undefined}
      clientLogo={clientLogo ?? undefined}
      industry={clientConfig.industry ?? industry}
      industryOptions={industryOptions}
      printMode={printMode}
    />
  );
}
