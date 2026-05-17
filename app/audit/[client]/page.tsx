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

  return (
    <AuditDashboard
      audit={audit}
      clientSlug={client}
      industry={industry}
      industryOptions={industryOptions}
    />
  );
}
