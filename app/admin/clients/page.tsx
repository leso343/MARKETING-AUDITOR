import Link from "next/link";
import { listVisibleClients, requireUser } from "@/lib/access";
import NewClientForm from "./NewClientForm";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const user = await requireUser();
  const clients = await listVisibleClients();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Clients
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>Clients</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {user.role === "admin" ? "All clients across all agencies." : "Clients owned by your agency."}
        </p>
      </div>

      <NewClientForm />

      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-3">
          Existing clients ({clients.length})
        </div>
        {clients.length === 0 ? (
          <div className="panel text-sm text-[var(--text-dim)]">No clients yet. Create your first one above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <Link key={c.id} href={`/admin/clients/${c.slug}`} className="panel hover:border-[var(--red)] transition-colors">
                <div className="panel-label">{c.name}</div>
                <div className="font-semibold mt-1">{c.name}</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  {c.subtitle ?? c.industry ?? "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
