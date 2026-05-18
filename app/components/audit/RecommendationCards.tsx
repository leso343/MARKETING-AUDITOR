"use client";

import type { AuditResult } from "@/engine/runAudit";
import copyBank from "@/data/copy-bank.json";
import { CheckCircle2, AlertOctagon, AlertTriangle } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useReport } from "@/context/ReportContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #333",
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#fff",
      }}
    >
      <div style={{ color: "#888", marginBottom: 4 }}>{label}</div>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <div key={p.dataKey} style={{ color: p.stroke ?? p.fill ?? "#fff" }}>
            {p.name}: ${p.value}
          </div>
        ),
      )}
    </div>
  );
}

const DONUT_SEGMENTS = [
  { name: "What's Working", value: 70, color: "var(--red)" },
  { name: "New Placements", value: 20, color: "#374151" },
  { name: "Experiments", value: 10, color: "#1f2937" },
];

const DONUT_DESCRIPTIONS = [
  "Keep scaling what's already converting",
  "Try Reels & Stories safely",
  "Storm-season hooks, fresh offers",
];

const DONUT_PERCENTS = ["70%", "20%", "10%"];

export default function RecommendationCards({ audit }: Props) {
  const { t } = useLang();
  const { openReport } = useReport();
  const recos = buildRecos(audit);

  const cur = audit.spend.blendedCpl;
  const tgt = audit.benchmarks.targetCpl;
  const curAboveTgt = cur > tgt;

  const projData =
    cur > 0
      ? [0, 2, 7, 14, 21, 30].map((day) => {
          const p = day / 30;
          const ease = 1 - Math.pow(1 - p, 2);
          if (curAboveTgt) {
            // CPL too high: fixes pull it down toward target; inaction lets it climb
            return {
              day: `Day ${day}`,
              withFixes: parseFloat((cur - (cur - tgt) * ease).toFixed(2)),
              withoutFixes: parseFloat((cur * (1 + p * 0.12)).toFixed(2)),
            };
          } else {
            // CPL already below benchmark: fixes improve further; inaction drifts up toward ceiling
            return {
              day: `Day ${day}`,
              withFixes: parseFloat((cur * (1 - p * 0.10)).toFixed(2)),
              withoutFixes: parseFloat((cur * (1 + p * 0.35)).toFixed(2)),
            };
          }
        })
      : [];

  return (
    <div className="panel">
      <div className="panel-label">{t("30_Day_Fix_Queue", "Action Plan")}</div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight"
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

      {/* Chart 2 — 30-Day CPL Trajectory */}
      {cur > 0 && (
        <div className="mt-8">
          <div
            className="mb-1 font-mono uppercase tracking-wider"
            style={{ fontSize: 9, color: "var(--red-dim, #7f1d1d)", letterSpacing: "0.12em" }}
          >
            PROJECTED CPL — 30-DAY ROADMAP
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={projData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#1a1a1a" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => "$" + v}
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine
                y={tgt}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                label={{
                  value: curAboveTgt ? `$${tgt} GOAL` : `$${tgt} BENCHMARK CEILING`,
                  position: "insideRight",
                  fill: "#fbbf24",
                  fontSize: 9,
                  fontFamily: "monospace",
                }}
              />
              <Line
                type="monotone"
                dataKey="withFixes"
                name="With fixes"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="withoutFixes"
                name="Without fixes"
                stroke="#ff0000"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Custom legend */}
          <div className="mt-2 flex gap-5">
            <span className="font-mono text-[10px]" style={{ color: "#4ade80" }}>
              ▬ {curAboveTgt ? "With fixes (CPL drops)" : "With fixes (CPL improves)"}
            </span>
            <span className="font-mono text-[10px]" style={{ color: "#ff0000" }}>
              ╌ {curAboveTgt ? "Without fixes (CPL rises)" : "Without fixes (CPL drifts up)"}
            </span>
          </div>
          <p className="mt-2 text-xs italic text-[var(--text-dim)]">
            {curAboveTgt
              ? `Executing the fix queue should pull CPL from $${cur.toFixed(2)} → $${tgt.toFixed(2)} by Day 30.`
              : `You're beating the $${tgt.toFixed(2)} benchmark at $${cur.toFixed(2)} CPL. These fixes protect and extend that edge.`}
          </p>
        </div>
      )}

      {/* Chart 3 — Budget Allocation Donut */}
      {recos.length > 0 && (
        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Donut */}
          <div className="relative flex-shrink-0" style={{ width: 180, height: 180 }}>
            <PieChart width={180} height={180}>
              <Pie
                data={DONUT_SEGMENTS}
                cx={85}
                cy={85}
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {DONUT_SEGMENTS.map((seg, i) => (
                  <Cell key={i} fill={seg.color} />
                ))}
              </Pie>
            </PieChart>
            {/* Center label */}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-mono font-bold text-white"
              style={{ fontSize: 9, lineHeight: 1.4 }}
            >
              MONTHLY<br />BUDGET
            </div>
          </div>
          {/* Legend list */}
          <div className="flex flex-col gap-3">
            {DONUT_SEGMENTS.map((seg, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex-shrink-0"
                  style={{ width: 10, height: 10, background: seg.color }}
                />
                <div>
                  <div className="font-mono text-[11px] font-bold text-white">
                    {seg.name} — {DONUT_PERCENTS[i]}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)]">
                    {DONUT_DESCRIPTIONS[i]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <button
        onClick={() => openReport(3)}
        className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        → {t("View full analysis →", "See detailed breakdown →")}
      </button>
    </div>
  );
}
