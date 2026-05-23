"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Check,
  Loader2,
  Pencil,
  Trash2,
  Shield,
  UserCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  Key,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  agencyId: string | null;
  createdAt: string;
};

type Agency = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  users: User[];
  agencies: Agency[];
};

/* ═════════════════════════════════════════════════════════════════════ */
/* Create User Form                                                    */
/* ═════════════════════════════════════════════════════════════════════ */
function CreateUserForm({ agencies, onClose }: { agencies: Agency[]; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<"agency" | "admin">("agency");
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          password,
          role,
          agencyId: agencyId || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 border-[var(--red)]/30">
      <div className="flex items-center justify-between">
        <div className="panel-label mb-0 flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-[var(--red)]" />
          Create user
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> Email</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@agency.com"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
            <span className="flex items-center gap-1"><Key className="h-2.5 w-2.5" /> Password</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 pr-9 text-sm font-mono focus:border-[var(--red)] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "agency")}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
            >
              <option value="agency">Agency</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
              Agency
            </label>
            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm focus:border-[var(--red)] outline-none"
            >
              <option value="">None</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono text-[var(--red)] flex items-center gap-1.5">
          <X className="h-3 w-3" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded bg-[var(--red)] px-4 py-2 text-white font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        {pending ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* User Row                                                            */
/* ═════════════════════════════════════════════════════════════════════ */
function UserRow({ user, agencies }: { user: User; agencies: Agency[] }) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState(user.role);
  const [agencyId, setAgencyId] = useState(user.agencyId ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, startSave] = useTransition();

  const [confirming, setConfirming] = useState(false);
  const [pendingDelete, startDelete] = useTransition();

  const agencyName = agencies.find((a) => a.id === user.agencyId)?.name;

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const body: Record<string, unknown> = { userId: user.id };
      if (name.trim() !== (user.name ?? "")) body.name = name.trim();
      if (role !== user.role) body.role = role;
      if (agencyId !== (user.agencyId ?? "")) body.agencyId = agencyId || null;
      if (newPassword.length >= 8) body.password = newPassword;

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setEditing(false);
      setNewPassword("");
      router.refresh();
    });
  };

  const onDelete = () => {
    startDelete(async () => {
      const res = await fetch(`/api/users?userId=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  };

  if (confirming) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/[0.03] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400">
            Delete {user.email}?
          </span>
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          The user will lose access immediately. This cannot be undone.
        </p>
        {error && (
          <div className="text-xs font-mono text-red-400">{error}</div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={onDelete}
            disabled={pendingDelete}
            className="flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 text-white font-mono text-[10px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {pendingDelete ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-[var(--text-dim)]">{user.email}</span>
          <button
            onClick={() => { setEditing(false); setError(null); setNewPassword(""); }}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:border-[var(--red)] outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:border-[var(--red)] outline-none"
            >
              <option value="agency">Agency</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1">Agency</label>
            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs focus:border-[var(--red)] outline-none"
            >
              <option value="">None</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs font-mono focus:border-[var(--red)] outline-none"
            />
          </div>
        </div>
        {error && (
          <div className="text-xs font-mono text-[var(--red)]">{error}</div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={pendingSave}
            className="flex items-center gap-1.5 rounded bg-[var(--red)] px-3 py-1.5 text-white font-mono text-[10px] uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {pendingSave ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:border-[var(--red)]/30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]">
          {user.role === "admin" ? (
            <Shield className="h-3.5 w-3.5 text-[var(--red)]" />
          ) : (
            <UserCircle className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {user.name || user.email}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider border ${
                user.role === "admin"
                  ? "border-[var(--red)]/30 bg-[var(--red)]/10 text-[var(--red)]"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-dim)]"
              }`}
            >
              {user.role}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-[var(--text-dim)] truncate">
              {user.email}
            </span>
            {agencyName && (
              <>
                <span className="text-[var(--border)]">&middot;</span>
                <span className="font-mono text-[10px] text-[var(--text-dim)]">
                  {agencyName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--red)] transition-all"
        >
          <Pencil className="h-2.5 w-2.5" />
          Edit
        </button>
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] hover:border-red-500 hover:text-red-400 transition-all"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */
/* Main list                                                           */
/* ═════════════════════════════════════════════════════════════════════ */
export default function UserList({ users, agencies }: Props) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {creating ? (
        <CreateUserForm agencies={agencies} onClose={() => setCreating(false)} />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="panel flex w-full items-center justify-center gap-2 py-4 text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--text)]"
        >
          <Plus className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            Create new user
          </span>
        </button>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <UserRow key={u.id} user={u} agencies={agencies} />
        ))}
      </div>

      {users.length === 0 && (
        <div className="panel flex flex-col items-center justify-center py-12 text-center">
          <UserCircle className="h-10 w-10 text-[var(--text-dim)] mb-3" />
          <div className="text-sm font-semibold">No users yet</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Create the first user above to get started.
          </div>
        </div>
      )}
    </div>
  );
}
