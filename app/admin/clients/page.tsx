import Link from "next/link";
import { listVisibleClients, requireUser } from "@/lib/access";
import { Building2, ArrowUpRight, FolderOpen } from "lucide-react";
import NewClientForm from "./NewClientForm";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const user = await requireUser();
  const clients = await listVisibleClients();

  return (
    <div className="space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Clients
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
          Clients
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {user.role === "admin"
            ? `${clients.length} client${clients.length !== 1 ? "s" : ""} across all agencies.`
            : `${clients.length} client${clients.length !== 1 ? "s" : ""} in your agency.`}
        </p>
      </div>

      <NewClientForm />

      {clients.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-10 w-10 text-[var(--text-dim)] mb-3" />
          <div className="text-sm font-semibold">No clients yet</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Create your first client above to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.slug}`}
              className="group panel transition-all hover:border-[var(--red)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--border)] bg-black">
                  <Building2 className="h-4 w-4 text-[var(--red)]" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-[var(--text-dim)] transition-colors group-hover:text-[var(--red)]" />
              </div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                {c.subtitle ?? (c.industry ? `Industry · ${c.industry}` : "—")}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
                  /{c.slug}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
