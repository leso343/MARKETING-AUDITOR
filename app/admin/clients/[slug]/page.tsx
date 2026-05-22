import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisibleClientBySlug, listClientCsvs } from "@/lib/access";
import UploadCsvForm from "./UploadCsvForm";
import DeleteCsvButton from "./DeleteCsvButton";

export const dynamic = "force-dynamic";

const REQUIRED_EXPORTS = [
  { name: "campaigns.csv", desc: "Campaign-level metrics (spend, leads, frequency)" },
  { name: "ads.csv", desc: "Ad-level metrics + Quality / Engagement / Conversion rankings" },
  { name: "breakdowns.csv", desc: "DMA / region geographic breakdown" },
  { name: "breakdown_age_gender.csv", desc: "Age × gender breakdown" },
  { name: "breakdown_placement.csv", desc: "Placement breakdown (feed / reels / story / etc.)" },
];

export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getVisibleClientBySlug(slug);
  if (!client) notFound();

  const csvs = await listClientCsvs(client.id);
  const have = new Set(csvs.map((c) => c.filename.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/admin/clients" className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] hover:text-white">
          &lt; All clients
        </Link>
        <h1 className="text-2xl font-bold mt-2" style={{ fontFamily: "var(--font-head)" }}>{client.name}</h1>
        <p className="text-sm text-[var(--text-dim)]">
          {client.subtitle ?? client.industry ?? "—"}
        </p>
        <div className="mt-3">
          <Link href={`/audit/${client.slug}`} className="inline-block bg-[var(--red)] text-white font-mono text-xs uppercase tracking-widest px-3 py-2 hover:opacity-90">
            Open audit dashboard →
          </Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-label mb-3">Required Meta Ads exports</div>
        <ul className="text-sm space-y-2">
          {REQUIRED_EXPORTS.map((r) => {
            const ok = have.has(r.name.toLowerCase());
            return (
              <li key={r.name} className="flex items-start gap-3">
                <span className={`mt-1 inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-[var(--text-dim)]"}`} />
                <div>
                  <div className="font-mono">{r.name}</div>
                  <div className="text-xs text-[var(--text-dim)]">{r.desc}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <UploadCsvForm slug={client.slug} />

      <div className="panel">
        <div className="panel-label mb-3">Uploaded files ({csvs.length})</div>
        {csvs.length === 0 ? (
          <div className="text-sm text-[var(--text-dim)]">Nothing uploaded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                <th className="py-2">Filename</th>
                <th className="py-2">Uploaded</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {csvs.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 font-mono">{c.filename}</td>
                  <td className="py-2 text-[var(--text-dim)]">{new Date(c.uploadedAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <DeleteCsvButton slug={client.slug} filename={c.filename} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
