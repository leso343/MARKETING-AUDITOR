"use client";

import type { AuditResult } from "@/engine/runAudit";
import copyBank from "@/data/copy-bank.json";
import { CheckCircle2, AlertOctagon, AlertTriangle } from "lucide-react";
import { useLang } from "@/context/LangContext";

interface Props {
  audit: AuditResult;
}

type CopyBankEntry = {
  severity: "critical" | "warn" | "ok";
  title: string;
  headline: string;
  fixSteps: string[];
  impactNote: string;
};

type CopyBank = {
  findings: Record<string, CopyBankEntry>;
  primaryActions: string[];
};

const TYPED_BANK = copyBank as unknown as CopyBank;

interface Reco extends CopyBankEntry {
  key: string;
  impactUSD: number;
  resolvedHeadline: string;
}

function resolve(s: string, ctx: Record<string, string | number>): string {
  return s.replace(/{{(\w+)}}/g, (_, k) =>
    ctx[k] !== undefined ? String(ctx[k]) : `{{${k}}}`,
  );
}

function buildRecos(a: AuditResult): Reco[] {
  const out: Reco[] = [];
  const bank = TYPED_BANK.findings;

  if (a.funnel.clickToSessionLossPct > 30 && bank.FUNNEL_CLICK_TO_SESSION_LOSS) {
    const f = bank.FUNNEL_CLICK_TO_SESSION_LOSS;
    out.push({
      key: "FUNNEL_CLICK_TO_SESSION_LOSS",
      ...f,
      resolvedHeadline: resolve(f.headline, { clickToSessionLossPct: a.funnel.clickToSessionLossPct }),
      impactUSD: Math.round((a.spend.totalSpend * a.funnel.clickToSessionLossPct) / 100),
    });
  }

  for (const tf of a.tracking.failures) {
    if (tf.type === "LEAD_PIXEL_DISCONNECTED" && bank.LEAD_PIXEL_DISCONNECTED) {
      const f = bank.LEAD_PIXEL_DISCONNECTED;
      out.push({
        key: tf.type,
        ...f,
        resolvedHeadline: resolve(f.headline, {
          count: a.tracking.brokenLeadCampaigns,
          spend: Math.round(tf.estimatedImpact).toLocaleString(),
        }),
        impactUSD: Math.round(tf.estimatedImpact),
      });
    }
    if (tf.type === "WRONG_OPTIMIZATION_EVENT" && bank.WRONG_OPTIMIZATION_EVENT) {
      out.push({
        key: tf.type,
        ...bank.WRONG_OPTIMIZATION_EVENT,
        resolvedHeadline: bank.WRONG_OPTIMIZATION_EVENT.headline,
        impactUSD: Math.round(tf.estimatedImpact),
      });
    }
    if (tf.type === "ATTRIBUTION_WINDOW_UNSET" && bank.ATTRIBUTION_WINDOW_UNSET) {
      const f = bank.ATTRIBUTION_WINDOW_UNSET;
      out.push({
        key: tf.type,
        ...f,
        resolvedHeadline: resolve(f.headline, { count: tf.affectedCampaigns.length }),
        impactUSD: 0,
      });
    }
  }

  if (a.geo.wasteUSD > 100 && TYPED_BANK.findings.GEO_LEAK_OUT_OF_AREA) {
    const f = TYPED_BANK.findings.GEO_LEAK_OUT_OF_AREA;
    out.push({
      key: "GEO_LEAK_OUT_OF_AREA",
      ...f,
      resolvedHeadline: resolve(f.headline, { wasteUSD: Math.round(a.geo.wasteUSD).toLocaleString() }),
      impactUSD: Math.round(a.geo.wasteUSD),
    });
  }

  if (a.creative.wasters.length > 0 && bank.CREATIVE_DEAD_WEIGHT) {
    const f = bank.CREATIVE_DEAD_WEIGHT;
    const totalWaste = a.creative.wasters.reduce((s, w) => s + w.spend, 0);
    out.push({
      key: "CREATIVE_DEAD_WEIGHT",
      ...f,
      resolvedHeadline: resolve(f.headline, { count: a.creative.wasters.length }),
      impactUSD: Math.round(totalWaste),
    });
  }

  if (a.spend.averageFrequency > 2.5 && bank.FREQUENCY_FATIGUE) {
    const f = bank.FREQUENCY_FATIGUE;
    out.push({
      key: "FREQUENCY_FATIGUE",
      ...f,
      resolvedHeadline: resolve(f.headline, { frequency: a.spend.averageFrequency.toFixed(2) }),
      impactUSD: 0,
    });
  }

  return out.sort((x, y) => y.impactUSD - x.impactUSD);
}

const ICON_FOR: Record<string, typeof AlertOctagon> = {
  critical: AlertOctagon,
  warn: AlertTriangle,
  ok: CheckCircle2,
};

export default function RecommendationCards({ audit }: Props) {
  const { t } = useLang();
  const recos = buildRecos(audit);

  return (
    <div className="panel">
      <div className="panel-label">{t("30_Day_Fix_Queue", "Action Plan")}</div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {t("Recommendations", "What to Fix")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {t(
              "Ordered by dollar impact. Tackle from the top.",
              "Listed from most to least costly. Start at the top.",
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            {t("Total Issues", "Issues Found")}
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">{recos.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {recos.length === 0 && (
          <div className="col-span-2 border border-[var(--border)] p-6 text-center text-sm text-[var(--text-dim)]">
            {t(
              "No issues surfaced — account looks clean against current benchmarks.",
              "No issues found — your account looks good against current targets.",
            )}
          </div>
        )}
        {recos.map((r) => {
          const Icon = ICON_FOR[r.severity] ?? AlertOctagon;
          const accent =
            r.severity === "critical" ? "var(--red)" : r.severity === "warn" ? "#fbbf24" : "#4ade80";
          return (
            <div
              key={r.key}
              className="border border-[var(--border)] bg-black p-5"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <Icon className="h-4 w-4" style={{ color: accent }} />
                <div className="flex items-center gap-2">
                  <span className="status-pill" style={{ color: accent }}>
                    {r.severity.toUpperCase()}
                  </span>
                  {r.impactUSD > 0 && (
                    <span className="font-mono text-xs font-bold text-white">
                      ${r.impactUSD.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div
                className="mb-2 text-sm font-bold uppercase tracking-tight"
                style={{ fontFamily: "var(--font-head)" }}
              >
                {r.title}
              </div>
              <div className="mb-3 text-xs leading-relaxed text-[var(--text-dim)]">
                {r.resolvedHeadline}
              </div>
              <ol className="mb-3 space-y-1.5 pl-1">
                {r.fixSteps.map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-[11px] text-white">
                    <span className="font-mono text-[10px]" style={{ color: accent }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="border-t border-[var(--border)] pt-2 font-mono text-[10px] italic text-[var(--text-dim)]">
                {r.impactNote}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border border-[var(--border)] bg-black p-4">
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[2px] text-[var(--red)]">
          {t("Sequence", "Priority Order")}
        </div>
        <ol className="space-y-1.5 text-[11px] text-[var(--text-dim)]">
          {TYPED_BANK.primaryActions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[10px] text-[var(--red)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {a}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
