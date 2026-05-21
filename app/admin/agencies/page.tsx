import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  await requireAdmin();
  const agencies = await db.select().from(schema.agencies);
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Agencies
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>Agencies</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Admins see all agencies. New agencies are seeded via <code>npm run db:seed</code> for now.
        </p>
      </div>
      <div className="panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
              <th className="py-2">Slug</th>
              <th className="py-2">Name</th>
              <th className="py-2">Primary color</th>
              <th className="py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id} className="border-b border-[var(--border)]/60">
                <td className="py-2 font-mono">{a.slug}</td>
                <td className="py-2">{a.name}</td>
                <td className="py-2 font-mono">
                  <span className="inline-block h-3 w-3 align-middle mr-2 border border-[var(--border)]"
                    style={{ background: a.primaryColor ?? "#ff0000" }} />
                  {a.primaryColor}
                </td>
                <td className="py-2 text-[var(--text-dim)]">{new Date(a.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
