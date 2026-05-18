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
  searchParams: Promise<{ cpl?: string; ctr?: string; industry?: string }>;
}

function prettyClient(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { client } = await params;
  const search = await searchParams;

  const csvDir = path.join(process.cwd(), "public", "csvs", client);
  if (!fs.existsSync(csvDir)) {
    notFound();
  }

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
  const benchmarks = {
    targetCpl: search.cpl ? Number(search.cpl) : base.targetCpl,
    targetCtr: search.ctr ? Number(search.ctr) : base.targetCtr,
  };

  const audit = runAudit({
    csvDir,
    clientName: prettyClient(client),
    benchmarks,
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

  return (
    <AuditDashboard
      audit={audit}
      clientSlug={client}
      industry={industry}
      industryOptions={industryOptions}
    />
  );
}
