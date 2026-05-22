import { requireUser, getCurrentAgency } from "@/lib/access";
import { redirect } from "next/navigation";
import { Palette, Shield } from "lucide-react";
import AgencyBrandingForm from "./AgencyBrandingForm";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  const agency = await getCurrentAgency();
  if (!agency && user.role !== "admin") redirect("/");

  return (
    <div className="space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Settings
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>
          Settings
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Agency branding and account security.
        </p>
      </div>

      {/* ── branding section ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <Palette className="h-4 w-4 text-[var(--red)]" />
          </div>
          <div>
            <div className="text-sm font-bold">Branding</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
              Colors and identity shown across all dashboards
            </div>
          </div>
        </div>

        {agency ? (
          <AgencyBrandingForm
            agencyId={agency.id}
            defaults={{
              name: agency.name,
              logoUrl: agency.logoUrl ?? "",
              primaryColor: agency.primaryColor ?? "#ff0000",
              secondaryColor: agency.secondaryColor ?? "",
              accentColor: agency.accentColor ?? "",
              highlightColor: agency.highlightColor ?? "",
              popColor: agency.popColor ?? "",
            }}
          />
        ) : (
          <div className="panel flex flex-col items-center justify-center py-10 text-center">
            <Palette className="h-8 w-8 text-[var(--text-dim)] mb-2" />
            <div className="text-sm font-semibold">No agency assigned</div>
            <div className="text-xs text-[var(--text-dim)] mt-1">
              You&apos;re an admin without an agency. Create one to manage branding.
            </div>
          </div>
        )}
      </div>

      {/* ── divider ──────────────────────────────────────────────── */}
      <div className="border-t border-[var(--border)]" />

      {/* ── security section ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <Shield className="h-4 w-4 text-[var(--red)]" />
          </div>
          <div>
            <div className="text-sm font-bold">Security</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
              Account password and authentication
            </div>
          </div>
        </div>

        <ChangePasswordForm />
      </div>
    </div>
  );
}
