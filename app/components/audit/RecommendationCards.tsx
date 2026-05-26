"use client";

import type { AuditResult } from "@/engine/runAudit";
import copyBank from "@/data/copy-bank.json";
import { CheckCircle2, AlertOctagon, AlertTriangle, TrendingUp, Activity, Trash2 } from "lucide-react";
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
  targetCpl?: number;
  targetCtr?: number;
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
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--text)",
      }}
    >
      <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <div key={p.dataKey} style={{ color: p.stroke ?? p.fill ?? "var(--text)" }}>
            {p.name}: ${p.value}
          </div>
        ),
      )}
    </div>
  );
}

// Per-issue rationale — specific "why this is ranked here" copy
const WHY: Record<string, (r: Reco, cur: number, tgt: number) => string> = {
  CREATIVE_DEAD_WEIGHT: (r) =>
    `$${r.impactUSD.toLocaleString()} was spent on ${r.resolvedHeadline.match(/\d+/)?.[0] ?? ""}  ad(s) that returned zero leads. This waste is certain — not probabilistic. Every additional day they run compounds the loss with no upside.`,
  GEO_LEAK_OUT_OF_AREA: (r) =>
    `$${r.impactUSD.toLocaleString()} is flowing to markets your sales team physically can't service. This isn't underperformance — it's a hard impossibility. The cleanest cut in the account.`,
  LEAD_PIXEL_DISCONNECTED: () =>
    `Meta's algorithm is flying blind. Without a firing pixel, every targeting, bidding, and placement decision is based on corrupt signals. Fix tracking before optimising anything else or you're scaling in the dark.`,
  FUNNEL_CLICK_TO_SESSION_LOSS: (r) =>
    `${r.resolvedHeadline.match(/\d+/)?.[0] ?? ""}% of paid clicks evaporated before reaching your site. You're paying CPCs on traffic that never had a chance to convert — the funnel leaks at step one.`,
  WRONG_OPTIMIZATION_EVENT: () =>
    `Meta is training its delivery algorithm on the wrong conversion goal. Every impression makes the system better at finding the wrong buyer. Learning resets are painful but necessary.`,
  ATTRIBUTION_WINDOW_UNSET: () =>
    `Campaigns are measured with inconsistent windows, making cross-campaign comparison and trend analysis unreliable. You can't trust any optimisation recommendation until reporting is standardised.`,
  FREQUENCY_FATIGUE: (r) =>
    `At ${r.resolvedHeadline.match(/[\d.]+/)?.[0] ?? "2.5+"}× average frequency, your core audience has seen these ads too many times. CTR is degrading and CPL will spike — this is early warning before the burnout spiral locks in.`,
};

const OUTCOME: Record<string, string> = {
  CREATIVE_DEAD_WEIGHT: "Immediate budget recovery. Every freed dollar reallocates to your top 25% of creatives — capital that was burning now works.",
  GEO_LEAK_OUT_OF_AREA: "Clean, instant waste removal. Redirect those dollars to hot DMAs where your team can actually close deals.",
  LEAD_PIXEL_DISCONNECTED: "Algorithm quality improves within 7–14 days as Meta re-accumulates clean conversion data. CPL typically falls 10–25% within the first month post-fix.",
  FUNNEL_CLICK_TO_SESSION_LOSS: "Recovery of wasted click spend. Page and redirect fixes typically show measurable CPL improvement in the first billing cycle.",
  WRONG_OPTIMIZATION_EVENT: "Delivery resets to correct buyer signals. Expect 2–4 week learning phase, then sustained CPL improvement as Meta targets the right audience.",
  ATTRIBUTION_WINDOW_UNSET: "Reporting becomes consistent and trustworthy. Campaign comparisons and optimisation recommendations all become reliable.",
  FREQUENCY_FATIGUE: "CTR stabilises, CPL stops drifting up. Fresh creative typically buys 4–6 weeks of healthy delivery before the next refresh cycle.",
};

export default function RecommendationCards({ audit, targetCpl }: Props) {
  const { t } = useLang();
  const { openReport } = useReport();
  const recos = buildRecos(audit);

  const cur = audit.spend.blendedCpl;
  // Use live prop if provided (slider dragging), otherwise fall back to server-rendered benchmark
  const tgt = targetCpl ?? audit.benchmarks.targetCpl;
  const curAboveTgt = cur > tgt;

  // Budget intelligence — computed from engine data.
  //
  // Chart audit P1 fix: previous implementation summed creative and geo
  // waste (which often overlap — a waster ad can deliver in a wasteful
  // region, and the two engines would double-count it) and clamped the
  // total at a magic totalSpend * 0.7. That clamp masked the
  // double-counting rather than fixing it.
  //
  // New rule (honest + conservative):
  //   winnerSpend = explicit creative.winners spend
  //   wasteSpend  = max(creative.wasters, geo.wasteUSD)
  //                 — take the worst of the two as a single ceiling
  //                 rather than adding them. Avoids double-counting.
  //   otherSpend  = total - winners - waste
  //                 — labeled "Other" not "Mixed" so users don't infer
  //                 a performance verdict the engine never made.
  const winnerSpend = audit.creative.winners.reduce((s, w) => s + w.spend, 0);
  const wasteCreative = audit.creative.wasters.reduce((s, w) => s + w.spend, 0);
  const wasteGeo = audit.geo.wasteUSD;
  const totalWaste = Math.max(wasteCreative, wasteGeo);
  const otherSpend = Math.max(0, audit.spend.totalSpend - winnerSpend - totalWaste);
  const totalBudget = audit.spend.totalSpend;
  const budgetSegments = [
    { label: "Converting", sub: "Sum of creative.winners spend", value: winnerSpend, color: "#4ade80" },
    { label: "Other",      sub: "Unranked — neither winner nor waster", value: otherSpend, color: "#fbbf24" },
    { label: "Waste",      sub: "Worst of creative-wasters / geo-waste", value: totalWaste, color: "#ff0000" },
  ].filter((s) => s.value > 0);
  const rec70 = Math.round(totalBudget * 0.70);
  const rec20 = Math.round(totalBudget * 0.20);
  const rec10 = Math.round(totalBudget * 0.10);
  const topWinner = audit.creative.winners[0];
  const projCplAfterCuts = audit.spend.totalLeads > 0 && totalWaste > 0
    ? (totalBudget - totalWaste) / audit.spend.totalLeads
    : 0;

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

  // Y-axis ticks at $20 intervals — include tgt so the reference line is always visible
  const yMax20 = projData.length > 0
    ? Math.ceil(Math.max(...projData.flatMap((d) => [d.withFixes, d.withoutFixes]), tgt) / 20) * 20
    : 160;
  const yTicks20 = Array.from({ length: Math.floor(yMax20 / 20) + 1 }, (_, i) => i * 20);

  return (
    <div className="panel">
      <div className="panel-label">{t("30_Day_Fix_Queue", "What to fix in the next 30 days")}</div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {t("Recommendations", "Things to fix")}
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
            {t("Total Issues", "Problems found")}
          </div>
          <div className="font-mono text-2xl font-extrabold text-[var(--text)]">{recos.length}</div>
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
              className="border border-[var(--border)] bg-[var(--card)] p-5"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <Icon className="h-4 w-4" style={{ color: accent }} />
                <div className="flex items-center gap-2">
                  <span className="status-pill" style={{ color: accent }}>
                    {r.severity.toUpperCase()}
                  </span>
                  {r.impactUSD > 0 && (
                    <span className="font-mono text-xs font-bold text-[var(--text)]">
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
                  <li key={idx} className="flex gap-2 text-[11px] text-[var(--text)]">
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
              <CartesianGrid vertical={false} className="chart-grid" stroke="#1a1a1a" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                className="chart-tick"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                ticks={yTicks20}
                domain={[0, yMax20]}
                tickFormatter={(v) => "$" + v}
                tick={{ fill: "#666", fontSize: 10, fontFamily: "monospace" }}
                className="chart-tick"
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

      {/* Budget Intelligence — data-driven from engine */}
      <div className="mt-8 border-t border-[var(--border)] pt-8">
        <div className="mb-1 font-mono uppercase tracking-wider" style={{ fontSize: 9, color: "var(--red-dim, #7f1d1d)", letterSpacing: "0.12em" }}>
          BUDGET EFFICIENCY ANALYSIS
        </div>

        <style>{`
          @keyframes rca-tile-in {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rca-bar-in {
            from { width: 0%; }
          }
          @keyframes rca-num-in {
            from { opacity: 0; transform: scale(0.88); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Stat tiles — premium redesign with icons + stagger animation */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {budgetSegments.map((seg, i) => {
            const pct = totalBudget > 0 ? Math.round((seg.value / totalBudget) * 100) : 0;
            const Icon = i === 0 ? TrendingUp : i === 1 ? Activity : Trash2;
            const action = i === 0 ? "▲ SCALE THIS" : i === 1 ? "→ OPTIMISE" : "✕ ELIMINATE";
            return (
              <div
                key={i}
                className="relative overflow-hidden border border-[var(--border)] bg-[var(--card)] p-5"
                style={{
                  borderTop: `2px solid ${seg.color}`,
                  animation: `rca-tile-in 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s both`,
                }}
              >
                {/* Icon watermark */}
                <Icon
                  className="absolute right-4 top-4 opacity-[0.07]"
                  style={{ width: 52, height: 52, color: seg.color }}
                  strokeWidth={1.5}
                />

                {/* Label + action */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" style={{ color: seg.color }} />
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: seg.color }}>
                      {seg.label}
                    </span>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-wider opacity-40" style={{ color: seg.color }}>
                    {action}
                  </span>
                </div>

                {/* Dollar amount */}
                <div
                  className="font-mono text-2xl font-extrabold text-[var(--text)]"
                  style={{ animation: `rca-num-in 0.5s ease ${i * 0.1 + 0.2}s both` }}
                >
                  ${seg.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>

                {/* Progress bar */}
                <div className="my-3 h-px w-full bg-[var(--border)]">
                  <div
                    style={{
                      height: 2,
                      width: `${pct}%`,
                      background: seg.color,
                      opacity: 0.7,
                      marginTop: -1,
                      animation: `rca-bar-in 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 0.1 + 0.3}s both`,
                    }}
                  />
                </div>

                {/* Percentage + description */}
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] font-bold" style={{ color: seg.color }}>{pct}%</span>
                  <span className="font-mono text-[9px] text-[var(--text-dim)]">of total spend</span>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">{seg.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Dual donut — Current vs Recommended */}
        <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">

          {/* Left: Current allocation from real engine data */}
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[8px] uppercase tracking-[2px] text-[var(--text-dim)]">Current</div>
            <div className="relative" style={{ width: 140, height: 140 }}>
              <PieChart width={140} height={140}>
                <Pie
                  data={budgetSegments.map(s => ({ name: s.label, value: s.value }))}
                  cx={65} cy={65}
                  innerRadius={42} outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                  isAnimationActive={false}
                >
                  {budgetSegments.map((seg, i) => (
                    <Cell key={i} fill={seg.color} opacity={0.85} />
                  ))}
                </Pie>
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="font-mono text-[7px] uppercase tracking-wider text-[var(--text-dim)]">actual</div>
                <div className="font-mono text-[11px] font-extrabold text-[var(--text)]">${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {budgetSegments.map((seg, i) => (
                <div key={i} className="flex items-center gap-1.5"
                  title={seg.sub /* hover reveals the underlying methodology for each segment */}>
                  <div style={{ width: 7, height: 7, background: seg.color, borderRadius: 1, opacity: 0.85, flexShrink: 0 }} />
                  <span className="font-mono text-[9px] text-[var(--text-dim)]">{seg.label} — {totalBudget > 0 ? Math.round((seg.value / totalBudget) * 100) : 0}%</span>
                </div>
              ))}
              <div
                className="mt-1 font-mono text-[8px] leading-snug text-[var(--text-dim)] opacity-70 max-w-[140px]"
                title="Converting = explicit winners. Waste = the larger of creative-wasters or geo-waste (avoids double-counting overlap). Other = everything else."
              >
                ⓘ How buckets are computed
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden sm:flex flex-col items-center gap-1 text-[var(--text-dim)]">
            <div className="font-mono text-[8px] uppercase tracking-wider opacity-40">fix &</div>
            <div className="text-lg opacity-40">→</div>
            <div className="font-mono text-[8px] uppercase tracking-wider opacity-40">reallocate</div>
          </div>

          {/* Right: Recommended 70/20/10 */}
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[8px] uppercase tracking-[2px]" style={{ color: "#4ade80" }}>Recommended</div>
            <div className="relative" style={{ width: 140, height: 140 }}>
              <PieChart width={140} height={140}>
                <Pie
                  data={[
                    { name: "Scale Winners",   value: 70 },
                    { name: "New Placements",  value: 20 },
                    { name: "Experiments",     value: 10 },
                  ]}
                  cx={65} cy={65}
                  innerRadius={42} outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90} endAngle={-270}
                  isAnimationActive={false}
                >
                  <Cell fill="var(--red)" opacity={0.9} />
                  <Cell fill="#374151" opacity={0.9} />
                  <Cell fill="#1f2937" opacity={0.9} />
                </Pie>
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="font-mono text-[7px] uppercase tracking-wider text-[var(--text-dim)]">target</div>
                <div className="font-mono text-[8px] font-extrabold" style={{ color: "#4ade80" }}>70/20/10</div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {[
                { label: "Scale Winners", color: "var(--red)", pct: "70%" },
                { label: "New Placements", color: "#374151", pct: "20%" },
                { label: "Experiments", color: "#4b5563", pct: "10%" },
              ].map((seg, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div style={{ width: 7, height: 7, background: seg.color, borderRadius: 1, flexShrink: 0 }} />
                  <span className="font-mono text-[9px] text-[var(--text-dim)]">{seg.label} — {seg.pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projected CPL callout beside donuts */}
          {projCplAfterCuts > 0 && totalWaste > 1 && (
            <div className="flex flex-col gap-1.5 border-l border-[var(--border)] pl-6 ml-2">
              <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "#4ade80" }}>Projected CPL after cuts</div>
              <div className="font-mono text-3xl font-extrabold" style={{ color: "#4ade80" }}>${projCplAfterCuts.toFixed(2)}</div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] line-through opacity-40 text-[var(--text)]">${cur.toFixed(2)}</span>
                <span className="font-mono text-[9px] font-bold" style={{ color: "#4ade80" }}>↓ {((1 - projCplAfterCuts / cur) * 100).toFixed(1)}% cheaper</span>
              </div>
              <div className="mt-1 border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
                <div className="font-mono text-[8px] text-[#4ade80] opacity-80">LOWER CPL = BETTER</div>
                <div className="font-mono text-[8px] text-[var(--text-dim)] mt-0.5">Cut ${Math.round(totalWaste).toLocaleString()} waste → same {audit.spend.totalLeads} leads, less spend</div>
              </div>
            </div>
          )}
        </div>

        {/* Recommended reallocation */}
        <div className="mb-3 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
          → Recommended Reallocation (70 / 20 / 10 Framework)
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              pct: "70%", amount: rec70, label: "Scale Winners",
              desc: topWinner
                ? `Double down on "${topWinner.adName}" — $${topWinner.cpl.toFixed(2)} CPL, top converter. These creatives and DMAs are already proving ROI.`
                : "Scale top-performing creatives and DMAs — they're already proving ROI.",
              color: "#4ade80",
            },
            {
              pct: "20%", amount: rec20, label: "New Placements",
              desc: "Expand to Reels + Stories. Same audience, fresh placement — typically 15–30% lower CPM with less competition than Feed.",
              color: "#fbbf24",
            },
            {
              pct: "10%", amount: rec10, label: "Experiments",
              desc: "Storm-season hooks, fresh offers, and A/B tests. Small budget, isolated tests — validate before committing scale.",
              color: "#9ca3af",
            },
          ].map((row, i) => (
            <div key={i} className="flex gap-3 border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="shrink-0 font-mono text-2xl font-extrabold tabular-nums" style={{ color: row.color, lineHeight: 1 }}>{row.pct}</div>
              <div>
                <div className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[var(--text)]">{row.label}</div>
                <div className="font-mono text-[11px] font-bold" style={{ color: row.color }}>${row.amount.toLocaleString()}/mo</div>
                <div className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-dim)]">{row.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* (CPL projection shown in the donut row above) */}
      </div>

      {/* Priority Fix Queue — dynamic from engine findings */}
      {recos.length > 0 && (
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <div className="mb-4 font-mono text-[9px] uppercase tracking-[2px] text-[var(--red)]">
            {t("Priority Fix Queue — Execute in Order", "Fix these in order")}
          </div>
          <div className="space-y-3">
            {recos.map((r, i) => {
              const accent = r.severity === "critical" ? "var(--red)" : r.severity === "warn" ? "#fbbf24" : "#4ade80";
              const why = WHY[r.key]?.(r, cur, tgt) ?? r.resolvedHeadline;
              const outcome = OUTCOME[r.key] ?? r.impactNote;
              return (
                <div key={r.key} className="border border-[var(--border)] bg-[var(--card)]" style={{ borderLeft: `3px solid ${accent}` }}>
                  <div className="flex items-start gap-4 p-4 pb-3">
                    <div className="shrink-0 font-mono text-3xl font-extrabold tabular-nums" style={{ color: accent, lineHeight: 1 }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <div className="font-mono text-[13px] font-extrabold uppercase tracking-tight text-[var(--text)]">{r.title}</div>
                        {r.impactUSD > 0 && (
                          <div className="border px-2 py-0.5 font-mono text-[10px] font-bold" style={{ color: accent, borderColor: accent, background: `color-mix(in srgb, ${accent} 8%, transparent)` }}>
                            ${r.impactUSD.toLocaleString()} AT RISK
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{why}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-[var(--border)] px-4 py-2.5">
                    <span className="shrink-0 mt-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">OUTCOME →</span>
                    <span className="text-[11px] text-[var(--text)]">{outcome}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => openReport(3)}
        className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-[var(--red)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      >
        → {t("View full analysis →", "See detailed breakdown →")}
      </button>
    </div>
  );
}
