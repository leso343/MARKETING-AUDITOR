"use client";

import type { AuditResult } from "@/engine/runAudit";
import { AlertOctagon, Flame, Target } from "lucide-react";
import { useLang } from "@/context/LangContext";

interface Props {
  audit: AuditResult;
}

interface Finding {
  title: string;
  plainTitle: string;
  detail: string;
  impactUSD: number;
  severity: "critical" | "warn" | "ok";
}

function topFindings(a: AuditResult): Finding[] {
  const out: Finding[] = [];

  if (a.funnel.clickToSessionLossPct > 30) {
    out.push({
      title: "Click-to-Session Hemorrhage",
      plainTitle: "Clicks Not Reaching Your Website",
      detail: `${a.funnel.clickToSessionLossPct}% of paid clicks never reached the site. Estimated wasted clicks: ${(a.funnel.totalClicks - a.funnel.estimatedSessions).toLocaleString()}.`,
      impactUSD: Math.round((a.spend.totalSpend * a.funnel.clickToSessionLossPct) / 100),
      severity: "critical",
    });
  }

  for (const f of a.tracking.failures) {
    if (f.severity === "critical" && f.estimatedImpact > 0) {
      out.push({
        title: f.type.replace(/_/g, " "),
        plainTitle: f.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        detail: f.description,
        impactUSD: f.estimatedImpact,
        severity: "critical",
      });
    }
  }

  if (a.geo.wasteUSD > 100) {
    out.push({
      title: "Geographic Waste",
      plainTitle: "Budget Spent Outside Your Service Area",
      detail: a.geo.recommendation,
      impactUSD: a.geo.wasteUSD,
      severity: "critical",
    });
  }

  if (a.creative.wasters.length > 0) {
    const wasteTotal = a.creative.wasters.reduce((s, w) => s + w.spend, 0);
    out.push({
      title: "Dead-Weight Creative",
      plainTitle: "Ads Spending Money With Zero Results",
      detail: `${a.creative.wasters.length} ad(s) burned $${Math.round(wasteTotal).toLocaleString()} with zero return.`,
      impactUSD: Math.round(wasteTotal),
      severity: "critical",
    });
  }

  return out.sort((x, y) => y.impactUSD - x.impactUSD).slice(0, 3);
}

export default function ExecutiveSummary({ audit }: Props) {
  const { t, plain } = useLang();
  const findings = topFindings(audit);
  const totalRecoverable = findings.reduce((s, f) => s + f.impactUSD, 0);

  return (
    <div className="panel">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="panel-label" style={{ marginBottom: 8 }}>
            {t("Executive_Summary", "Top Findings")}
          </div>
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {findings.length === 0
              ? t("Account Health Check", "No Issues Found")
              : findings.length === 1
              ? t("Highest-impact finding", "Top Issue to Fix")
              : t(`${findings.length} highest-impact findings`, `Top ${findings.length} Issues to Fix`)}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {t(
              "Ranked by dollar exposure. Fix in order.",
              "Listed from most to least costly. Start at the top.",
            )}
          </p>
        </div>
        <div className="sm:text-right">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            {t("Total Recoverable", "Money at Risk")}
          </div>
          <div className="font-mono text-3xl font-extrabold text-[var(--red)]">
            ${totalRecoverable.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {findings.length === 0 && (
          <div className="col-span-3 border border-[var(--border)] p-6 text-center text-sm text-[var(--text-dim)]">
            {t(
              "No critical findings detected — account is operating within healthy ranges.",
              "No major issues found — your campaigns look healthy against current benchmarks.",
            )}
          </div>
        )}
        {findings.map((f, idx) => {
          const Icon = idx === 0 ? Flame : idx === 1 ? AlertOctagon : Target;
          return (
            <div
              key={idx}
              className="relative border border-[var(--border)] bg-black p-5"
              style={{ borderLeft: "3px solid var(--red)" }}
            >
              <div className="mb-3 flex items-start justify-between">
                <Icon className="h-5 w-5 text-[var(--red)]" />
                <span className="status-pill status-critical">
                  RANK {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <div
                className="mb-2 text-base font-bold uppercase tracking-tight"
                style={{ fontFamily: "var(--font-head)" }}
              >
                {plain ? f.plainTitle : f.title}
              </div>
              <p className="mb-4 text-xs leading-relaxed text-[var(--text-dim)]">
                {f.detail}
              </p>
              <div className="border-t border-[var(--border)] pt-3">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                  {t("Impact", "Money at Risk")}
                </div>
                <div className="font-mono text-lg font-extrabold text-white">
                  ${f.impactUSD.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
