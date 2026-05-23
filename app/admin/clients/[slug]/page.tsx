import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisibleClientBySlug, listClientCsvs } from "@/lib/access";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  BarChart3,
  Clock,
  Trash2,
} from "lucide-react";
import UploadCsvForm from "./UploadCsvForm";
import DeleteCsvButton from "./DeleteCsvButton";
import EditClientForm from "./EditClientForm";
import DeleteClientButton from "./DeleteClientButton";

export const dynamic = "force-dynamic";

const REQUIRED_EXPORTS = [
  { name: "campaigns.csv", desc: "Campaign-level metrics — spend, leads, frequency, impressions" },
  { name: "ads.csv", desc: "Ad-level metrics — quality, engagement, and conversion rankings" },
  { name: "breakdowns.csv", desc: "DMA / region geographic breakdown for geo waste detection" },
  { name: "breakdown_age_gender.csv", desc: "Age × gender breakdown for demographic analysis" },
  { name: "breakdown_placement.csv", desc: "Placement breakdown — feed, reels, story, audience network" },
];

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getVisibleClientBySlug(slug);
  if (!client) notFound();

  const csvs = await listClientCsvs(client.id);
  const have = new Set(csvs.map((c) => c.filename.toLowerCase()));
  const completedCount = REQUIRED_EXPORTS.filter((r) => have.has(r.name.toLowerCase())).length;
  const allComplete = completedCount === REQUIRED_EXPORTS.length;

  return (
    <div className="space-y-6">
      {/* ── breadcrumb + header ──────────────────────────────────── */}
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[2px] text-[var(--text-dim)] hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          All clients
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-head)" }}
            >
              {client.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                /{client.slug}
              </span>
              {client.industry && (
                <>
                  <span className="text-[var(--border)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                    {client.industry}
                  </span>
                </>
              )}
            </div>
            {client.subtitle && (
              <p className="text-sm text-[var(--text-dim)] mt-1">{client.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <EditClientForm
              clientId={client.id}
              currentName={client.name}
              currentSubtitle={client.subtitle}
              currentIndustry={client.industry}
            />
            <DeleteClientButton
              clientId={client.id}
              clientName={client.name}
              clientSlug={client.slug}
            />
            <Link
              href={`/audit/${client.slug}`}
              className="group flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2.5 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Open audit
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── danger zone (delete confirmation renders here) ────── */}

      {/* ── data completeness ────────────────────────────────────── */}
      <div className="panel">
        <div className="flex items-center justify-between mb-5">
          <div className="panel-label mb-0">Data completeness</div>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${allComplete ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ boxShadow: `0 0 8px ${allComplete ? "rgba(16,185,129,0.5)" : "rgba(245,158,11,0.5)"}` }}
            />
            <span className={`font-mono text-[10px] uppercase tracking-widest ${allComplete ? "text-emerald-400" : "text-amber-400"}`}>
              {completedCount}/{REQUIRED_EXPORTS.length} files
            </span>
          </div>
        </div>

        {/* progress bar */}
        <div className="mb-5">
          <div className="h-1.5 w-full rounded-full bg-[#111] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(completedCount / REQUIRED_EXPORTS.length) * 100}%`,
                background: allComplete
                  ? "linear-gradient(90deg, #059669, #10b981)"
                  : "linear-gradient(90deg, #d97706, #f59e0b)",
              }}
            />
          </div>
        </div>

        {/* checklist */}
        <div className="space-y-1">
          {REQUIRED_EXPORTS.map((r) => {
            const ok = have.has(r.name.toLowerCase());
            return (
              <div
                key={r.name}
                className={`flex items-center gap-3 rounded px-3 py-2.5 transition-colors ${
                  ok ? "bg-emerald-500/5" : "bg-transparent hover:bg-white/[0.02]"
                }`}
              >
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs ${ok ? "text-white" : "text-[var(--text-dim)]"}`}>
                      {r.name}
                    </span>
                    {ok && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-emerald-400">
                        Uploaded
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{r.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── upload ───────────────────────────────────────────────── */}
      <UploadCsvForm slug={client.slug} />

      {/* ── uploaded files table ──────────────────────────────────── */}
      <div className="panel">
        <div className="flex items-center justify-between mb-4">
          <div className="panel-label mb-0">
            <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--red)]" />
            Uploaded files
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            {csvs.length} file{csvs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {csvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileSpreadsheet className="h-8 w-8 text-[var(--text-dim)] mb-2" />
            <div className="text-sm text-[var(--text-dim)]">No files uploaded yet</div>
            <div className="text-[10px] text-[var(--text-dim)] mt-1">
              Upload the 5 required Meta Ads exports above
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {csvs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--red)]" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">{c.filename}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-[var(--text-dim)]" />
                      <span className="font-mono text-[9px] text-[var(--text-dim)]">
                        {new Date(c.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <DeleteCsvButton slug={client.slug} filename={c.filename} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
