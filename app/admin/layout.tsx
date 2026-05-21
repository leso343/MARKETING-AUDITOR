import Link from "next/link";
import { requireUser } from "@/lib/access";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // agency users can manage their own clients; admins can do everything.
  if (user.role !== "admin" && user.role !== "agency") redirect("/");
  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] hover:text-white">
            &lt; Back to dashboard
          </Link>
          <Link href="/admin/clients" className="text-sm hover:text-[var(--red)]">Clients</Link>
          {user.role === "admin" && (
            <Link href="/admin/agencies" className="text-sm hover:text-[var(--red)]">Agencies</Link>
          )}
          <Link href="/admin/settings" className="text-sm hover:text-[var(--red)]">Settings</Link>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
          {user.email} · {user.role}
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
