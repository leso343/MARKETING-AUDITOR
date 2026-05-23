import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { Building2, Globe, Palette } from "lucide-react";
import NewAgencyForm from "./NewAgencyForm";
import AgencyCard from "./AgencyCard";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  await requireAdmin();
  const agencies = await db.select().from(schema.agencies);

  // Count clients per agency
  const clients = await db.select().from(schema.clients);
  const clientCounts = new Map<string, number>();
  for (const c of clients) {
    clientCounts.set(c.agencyId, (clientCounts.get(c.agencyId) ?? 0) + 1);
  }

  // Count users per agency
  const users = await db
    .select({ id: schema.users.id, agencyId: schema.users.agencyId })
    .from(schema.users);
  const userCounts = new Map<string, number>();
  for (const u of users) {
    if (u.agencyId) userCounts.set(u.agencyId, (userCounts.get(u.agencyId) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Agencies
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
          Agencies
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {agencies.length} registered agenc{agencies.length !== 1 ? "ies" : "y"}.
          Manage agency branding, settings, and access.
        </p>
      </div>

      <NewAgencyForm />

      {agencies.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-10 w-10 text-[var(--text-dim)] mb-3" />
          <div className="text-sm font-semibold">No agencies yet</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Create your first agency above to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {agencies.map((a) => (
            <AgencyCard
              key={a.id}
              agency={a}
              clientCount={clientCounts.get(a.id) ?? 0}
              userCount={userCounts.get(a.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
