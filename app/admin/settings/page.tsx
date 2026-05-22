import { requireUser, getCurrentAgency } from "@/lib/access";
import { redirect } from "next/navigation";
import AgencyBrandingForm from "./AgencyBrandingForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireUser();
  const agency = await getCurrentAgency();
  if (!agency && user.role !== "admin") redirect("/");

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--text-dim)] mb-2">
          &gt; Admin / Settings
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-head)" }}>Agency settings</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Branding shown in the dashboard header when one of your users is logged in.
        </p>
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
          }}
        />
      ) : (
        <div className="panel text-sm text-[var(--text-dim)]">
          You&apos;re an admin without an agency assignment. Create an agency to manage branding.
        </div>
      )}
    </div>
  );
}
