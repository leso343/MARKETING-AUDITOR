import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  await requireAdmin();
  const agencies = await db.select().from(schema.agencies);

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
        </p>
      </div>

      {agencies.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-10 w-10 text-[var(--text-dim)] mb-3" />
          <div className="text-sm font-semibold">No agencies yet</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Run the seed script or create one via the database.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agencies.map((a) => {
            const colors = [
              a.primaryColor ?? "#ff0000",
              a.secondaryColor,
              a.accentColor,
              a.highlightColor,
              a.popColor,
            ].filter(Boolean) as string[];

            return (
              <div key={a.id} className="panel">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg font-bold" style={{ fontFamily: "var(--font-head)" }}>
                      {a.name}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] mt-0.5">
                      /{a.slug}
                    </div>
                  </div>
                  {a.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.logoUrl} alt={a.name} className="h-8 w-auto" />
                  )}
                </div>

                {/* color palette strip */}
                <div className="mb-4">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-dim)] mb-1.5">
                    Brand palette
                  </div>
                  <div className="flex gap-1">
                    {colors.map((c, i) => (
                      <div
                        key={i}
                        className="h-6 flex-1 rounded-sm border border-white/10"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                    {colors.length < 5 &&
                      Array.from({ length: 5 - colors.length }).map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="h-6 flex-1 rounded-sm border border-dashed border-[var(--border)]"
                        />
                      ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[var(--text-dim)]">
                  <span className="font-mono text-[9px] uppercase tracking-wider">
                    Created {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: a.primaryColor ?? "#ff0000" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
