import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { Users, Shield, UserCircle } from "lucide-react";
import UserList from "./UserList";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireAdmin();

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      agencyId: schema.users.agencyId,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  const agencies = await db
    .select({
      id: schema.agencies.id,
      name: schema.agencies.name,
      slug: schema.agencies.slug,
    })
    .from(schema.agencies);

  return (
    <div className="space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Users
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
          Users
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {users.length} user{users.length !== 1 ? "s" : ""} across all agencies.
          Create, edit, and manage user access.
        </p>
      </div>

      {/* stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="panel text-center py-4">
          <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {users.length}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] flex items-center justify-center gap-1.5 mt-1">
            <Users className="h-3 w-3" />
            Total users
          </div>
        </div>
        <div className="panel text-center py-4">
          <div className="text-2xl font-bold text-[var(--red)]" style={{ fontFamily: "var(--font-head)" }}>
            {users.filter((u) => u.role === "admin").length}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] flex items-center justify-center gap-1.5 mt-1">
            <Shield className="h-3 w-3" />
            Admins
          </div>
        </div>
        <div className="panel text-center py-4">
          <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {users.filter((u) => u.role === "agency").length}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] flex items-center justify-center gap-1.5 mt-1">
            <UserCircle className="h-3 w-3" />
            Agency users
          </div>
        </div>
      </div>

      <UserList
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        agencies={agencies}
      />
    </div>
  );
}
