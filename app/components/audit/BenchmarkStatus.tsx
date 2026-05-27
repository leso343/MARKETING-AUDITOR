"use client";

import type { ReportingPeriod } from "@/engine/runAudit";
import { useLang } from "@/context/LangContext";
import { Lightbulb } from "lucide-react";

interface Props {
  blendedCpl: number;
  weightedCtr: number;
  liveCpl: number;
  liveCtr: number;
  industry: string;
  reportingPeriod: ReportingPeriod;
  isPreview?: boolean;
}

/* ── Contextual insight generator ─────────────────────────────────────────────
 *
 * Each generator returns BOTH the professional and plain-English copy so the
 * UI can flip cleanly with the language toggle. Earlier copy was deliberately
 * dramatised ("dead weight", "guaranteed losses") — replaced with measured
 * language that still calls the problem out without sounding alarmist.
 */

type Insight = {
  summary: string;
  detail: string;
  actions: string[];
};

type BilingualInsight = { pro: Insight; plain: Insight };

const EMPTY_INSIGHT: BilingualInsight = {
  pro:   { summary: "", detail: "", actions: [] },
  plain: { summary: "", detail: "", actions: [] },
};

function cplInsight(actual: number, target: number): BilingualInsight {
  if (actual <= 0 || target <= 0) return EMPTY_INSIGHT;

  const gap = actual - target;
  const pctOff = Math.abs(gap / target) * 100;
  const dollarGap = Math.abs(gap).toFixed(2);

  if (actual <= target) {
    const headroom = (target - actual).toFixed(2);
    return {
      pro: {
        summary: `Your $${actual.toFixed(2)} CPL is ${pctOff.toFixed(1)}% below target — leads are landing $${headroom} under your ceiling.`,
        detail: `Cost Per Lead (CPL) is the ad spend required to generate one tracked lead. At your $${target} target, the account is performing within healthy parameters.`,
        actions: [
          `Scale spend on the lowest-CPL campaigns while blended CPL remains under $${target}.`,
          `Document the creatives and audiences driving the $${actual.toFixed(2)} CPL so the formula can be replicated.`,
          "Monitor frequency — above 2.5×, CPL typically rises as audience fatigue sets in.",
        ],
      },
      plain: {
        summary: `Your $${actual.toFixed(2)} CPL is ${pctOff.toFixed(1)}% under your goal — you're getting leads for $${headroom} less than your ceiling.`,
        detail: `Cost Per Lead (CPL) is how much you pay in ad spend for every person who fills out a form or calls. Lower is better — and yours is already well under your $${target} goal.`,
        actions: [
          `Spend more on the ads with the cheapest leads — while your average CPL stays under $${target}.`,
          `Write down which ads and audiences are working so you can copy what's getting the $${actual.toFixed(2)} CPL.`,
          "Watch how often the same person sees your ad — once it goes above 2.5 times, leads usually get more expensive.",
        ],
      },
    };
  }

  if (pctOff <= 30) {
    return {
      pro: {
        summary: `CPL is $${dollarGap} over target — a moderate gap that is typically closable within 2–4 weeks of focused optimisation.`,
        detail: `You're paying $${actual.toFixed(2)} per lead against a $${target} target. A ${pctOff.toFixed(0)}% gap is recoverable through reducing zero-result spend and improving creative quality.`,
        actions: [
          `Pause ads with over $100 in spend and zero tracked leads — reducing non-converting spend is the fastest CPL lever.`,
          `Reduce geographic spend in regions where CPL exceeds $${(target * 1.5).toFixed(0)} and reallocate to top-performing areas.`,
          "Refresh creative on the highest-frequency ad sets to counter diminishing returns.",
        ],
      },
      plain: {
        summary: `Your lead cost is $${dollarGap} over your goal — a manageable gap you can close in 2–4 weeks with focused fixes.`,
        detail: `You're paying $${actual.toFixed(2)} per lead but you want to pay $${target}. The good news: a ${pctOff.toFixed(0)}% gap like this is usually fixable by cutting what isn't working and improving the ads themselves.`,
        actions: [
          `Pause any ads that have spent over $100 without getting a lead — cutting these is the fastest way to bring costs down.`,
          `Cut back spend in areas where each lead costs over $${(target * 1.5).toFixed(0)} and put that money into places that work better.`,
          "Refresh the ads people see most often — when the same ad runs too long, it stops working as well.",
        ],
      },
    };
  }

  return {
    pro: {
      summary: `CPL is ${pctOff.toFixed(0)}% above target — a structural gap requiring more than bid adjustments.`,
      detail: `You're paying $${actual.toFixed(2)} per lead against a $${target} target — a $${dollarGap} gap. Overruns at this scale usually indicate tracking issues, geographic misallocation, or persistent non-converting creative inflating the blended cost.`,
      actions: [
        "Verify pixel and conversion API firing — when Meta cannot see conversions, it optimises against the wrong signal and CPL inflates.",
        `Pause campaigns spending more than $${(target * 0.5).toFixed(0)} without tracked leads — these are sustained losses.`,
        "Consolidate ad sets into fewer, better-funded ones so Meta's algorithm has enough conversion data to optimise effectively.",
        `Tighten geographic targeting to top-converting service areas — out-of-area spend directly raises blended CPL.`,
      ],
    },
    plain: {
      summary: `Lead cost is ${pctOff.toFixed(0)}% over your goal — a big gap that needs real changes, not just small tweaks.`,
      detail: `You're paying $${actual.toFixed(2)} per lead, but you want to pay $${target} — a $${dollarGap} gap per lead. When costs are this far off, it's usually because tracking is broken, money is going to the wrong areas, or ads that never work are quietly driving the average up.`,
      actions: [
        "Check that Meta can actually see your leads coming in — if tracking is broken, Meta wastes your money on the wrong things.",
        `Pause any campaigns that spent over $${(target * 0.5).toFixed(0)} without a single lead — these are steady losses.`,
        "Combine several small ad sets into fewer bigger ones so Meta has enough data to find the right people.",
        `Narrow your targeting to the specific areas where you actually get leads — money spent outside your area drags everything up.`,
      ],
    },
  };
}

function ctrInsight(actual: number, target: number): BilingualInsight {
  if (actual <= 0 || target <= 0) return EMPTY_INSIGHT;

  const pctOff = Math.abs((actual - target) / target) * 100;

  if (actual >= target) {
    return {
      pro: {
        summary: `${actual.toFixed(2)}% CTR beats the ${target.toFixed(1)}% target — creative is generating strong click interest.`,
        detail: `Click-Through Rate (CTR) is the share of impressions that produce a click. At ${actual.toFixed(2)}%, the account is above the ${target.toFixed(1)}% benchmark, signalling solid creative–audience fit.`,
        actions: [
          "CTR is healthy — direct optimisation energy at CPL and conversion quality instead of click volume.",
          "Identify the specific ads driving the high CTR and protect their budget allocation.",
          "Avoid trading lead quality for CTR — a 5% CTR that converts poorly is worse than a 2% CTR that converts well.",
        ],
      },
      plain: {
        summary: `${actual.toFixed(2)}% click rate is better than your ${target.toFixed(1)}% goal — people are clicking your ads more than expected.`,
        detail: `Click-Through Rate (CTR) is the percentage of people who see your ad and click it. Higher is better, and at ${actual.toFixed(2)}% you're above the goal — your message is connecting.`,
        actions: [
          "Click rate is great — focus on making sure those clicks actually turn into leads, not just chasing more clicks.",
          "Find which specific ads are getting the most clicks and keep their budget steady.",
          "Don't try to push click rate higher if it means worse leads — a 5% click rate with bad leads is worse than a 2% click rate with good ones.",
        ],
      },
    };
  }

  return {
    pro: {
      summary: `${actual.toFixed(2)}% CTR is ${pctOff.toFixed(0)}% below the ${target.toFixed(1)}% target — creative is not compelling enough impressions into clicks.`,
      detail: `A ${actual.toFixed(2)}% CTR equates to roughly ${Math.round(actual * 10)} clicks per 1,000 impressions. Below the ${target.toFixed(1)}% benchmark, the creative, headline, or offer is likely under-resonating with the audience.`,
      actions: [
        "Lead with a sharper hook — open on the customer's pain point rather than the company name.",
        "Test video or Reels formats — they typically outperform static creative on CTR by 20–40%.",
        "Tighten audience targeting — a smaller, more relevant audience often produces a higher CTR even at lower reach.",
        "Run a headline A/B test — single-word changes can shift CTR by 30%.",
      ],
    },
    plain: {
      summary: `Only ${actual.toFixed(2)}% of people who see your ad click it — ${pctOff.toFixed(0)}% below your ${target.toFixed(1)}% goal. The ads aren't grabbing attention.`,
      detail: `A ${actual.toFixed(2)}% click rate means about ${Math.round(actual * 10)} out of every 1,000 people who see your ad click it. Below ${target.toFixed(1)}% usually means the ad image, headline, or offer isn't connecting with the people seeing it.`,
      actions: [
        "Start your ad with a problem your customer has (not your company name) — it grabs more attention.",
        "Try video or Reels — they usually get 20–40% more clicks than still images.",
        "Show your ad to a smaller, more specific group of people — they're more likely to click.",
        "Test different headlines — sometimes changing one word can boost click rate by 30%.",
      ],
    },
  };
}

/* ── Metric card ───────────────────────────────────────────────────────────── */

function Metric({
  label, actual, target, formatActual, formatTarget, lowerIsBetter,
}: {
  label: string; actual: number; target: number;
  formatActual: (v: number) => string; formatTarget: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  const { t } = useLang();
  if (actual <= 0 || target <= 0) return null;

  const passing = lowerIsBetter ? actual <= target : actual >= target;
  const absDelta = Math.abs(((actual - target) / target) * 100);
  const accent = passing ? "#4ade80" : absDelta > 50 ? "#ff0000" : "#fbbf24";
  const arrow = lowerIsBetter ? (actual < target ? "↓" : "↑") : (actual > target ? "↑" : "↓");
  const barPct = Math.min(lowerIsBetter ? (actual / target) * 100 : (target / actual) * 100, 100);

  // Localised position words
  const below = t("below", "under");
  const above = t("above", "over");
  const onTrack = t("on track", "looking good");
  const needsWork = t("needs work", "needs attention");
  const vsTarget = t("vs", "vs goal of");
  const targetWord = t("target", "goal");

  return (
    <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">{label}</span>
        <span
          className="border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider transition-colors duration-200"
          style={{ color: accent, borderColor: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)` }}
        >
          {passing ? t("PASS", "GOOD") : t("FAIL", "OFF")}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-extrabold transition-colors duration-200" style={{ color: accent }}>
          {formatActual(actual)}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-dim)]">
          {vsTarget} {formatTarget(target)} {targetWord}
        </span>
      </div>
      <div className="my-2 h-1 w-full rounded-sm bg-[var(--border)]">
        <div className="h-1 rounded-sm transition-all duration-300" style={{ width: `${barPct}%`, background: accent, opacity: 0.75 }} />
      </div>
      <div className="font-mono text-[10px]" style={{ color: accent }}>
        {passing
          ? `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? below : above} ${targetWord} — ${onTrack}`
          : `${arrow} ${absDelta.toFixed(1)}% ${lowerIsBetter ? above : below} ${targetWord} — ${needsWork}`}
      </div>
    </div>
  );
}

/* ── What-if insight card ──────────────────────────────────────────────────── */

function InsightCard({
  title, summary, detail, actions, accent,
}: {
  title: string; summary: string; detail: string; actions: string[]; accent: string;
}) {
  if (!summary) return null;
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] p-4" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>{title}</span>
      </div>
      <p className="mb-2 text-[11px] font-semibold text-[var(--text)] leading-relaxed">{summary}</p>
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-dim)]">{detail}</p>
      <div className="space-y-1.5">
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2 text-[11px]">
            <span className="shrink-0 font-mono text-[10px]" style={{ color: accent }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[var(--text-dim)] leading-relaxed">{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ───────────────────────────────────────────────────────────── */

export default function BenchmarkStatus({
  blendedCpl, weightedCtr, liveCpl, liveCtr, industry, reportingPeriod, isPreview,
}: Props) {
  const { t, plain } = useLang();

  const cplBilingual = cplInsight(blendedCpl, liveCpl);
  const ctrBilingual = ctrInsight(weightedCtr, liveCtr);
  // Pick the variant matching the current language toggle. Insight
  // strings are pre-computed in both languages above so the swap is
  // a single property lookup with no extra render work.
  const cplData = plain ? cplBilingual.plain : cplBilingual.pro;
  const ctrData = plain ? ctrBilingual.plain : ctrBilingual.pro;

  const cplPassing = blendedCpl > 0 && liveCpl > 0 && blendedCpl <= liveCpl;
  const ctrPassing = weightedCtr > 0 && liveCtr > 0 && weightedCtr >= liveCtr;

  const cplAccent = cplPassing ? "#4ade80" : Math.abs((blendedCpl - liveCpl) / liveCpl) > 0.5 ? "#ff0000" : "#fbbf24";
  const ctrAccent = ctrPassing ? "#4ade80" : "#fbbf24";

  return (
    <div
      className="panel py-4 transition-all duration-200"
      style={isPreview ? { borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.03)" } : {}}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="panel-label" style={{ marginBottom: 0 }}>
            {t("Benchmark Status", "How You Compare To The Goal")}
          </div>
          {isPreview && (
            <span className="border border-[#fbbf2440] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#fbbf24]">
              ⚡ {t("What-If Preview", "Trying Something New")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {reportingPeriod.isScaled && (
            <span className="border border-[#fbbf2440] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[#fbbf24]">
              ⚡ {t(
                `Est. ${reportingPeriod.filterDays}d of ${reportingPeriod.totalDays}d export`,
                `Estimated from ${reportingPeriod.filterDays} of ${reportingPeriod.totalDays} days`,
              )}
            </span>
          )}
          {!isPreview && (
            <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)] opacity-60">
              {t(
                "Drag sliders to explore what-if scenarios",
                "Drag the sliders to see what could change",
              )}
            </span>
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div className="flex flex-wrap gap-3">
        <Metric
          label={t("Blended CPL", "What each lead costs you")}
          actual={blendedCpl}
          target={liveCpl}
          formatActual={(v) => `$${v.toFixed(2)}`}
          formatTarget={(v) => `$${v.toFixed(0)}`}
          lowerIsBetter={true}
        />
        <Metric
          label={t("Weighted CTR", "How often people click")}
          actual={weightedCtr}
          target={liveCtr}
          formatActual={(v) => `${v.toFixed(2)}%`}
          formatTarget={(v) => `${v.toFixed(1)}%`}
          lowerIsBetter={false}
        />
        <div className="flex-1 min-w-[160px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
            {t("Industry", "Industry averages")}
          </div>
          <div className="font-mono text-sm font-bold capitalize text-[var(--text)]">{industry}</div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-dim)]">
            {t("CPL target:", "Lead cost goal:")} <span className="text-[var(--text)]">${liveCpl}</span>
          </div>
          <div className="font-mono text-[10px] text-[var(--text-dim)]">
            {t("CTR target:", "Click rate goal:")} <span className="text-[var(--text)]">{liveCtr.toFixed(1)}%</span>
          </div>
          <div className="mt-2 font-mono text-[8px] text-[var(--text-dim)] opacity-60">
            {isPreview
              ? t("What-if mode — reset slider to restore original", "Trying something new — slide back to undo")
              : t("Change industry → auto-sets benchmarks", "Pick your industry to set the right goals")}
          </div>
        </div>
      </div>

      {/* What-if insight panels — appear when slider is moved */}
      {isPreview && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <InsightCard
            title={t("CPL Insight", "What This Cost Means For You")}
            summary={cplData.summary}
            detail={cplData.detail}
            actions={cplData.actions}
            accent={cplAccent}
          />
          <InsightCard
            title={t("CTR Insight", "What This Click Rate Means")}
            summary={ctrData.summary}
            detail={ctrData.detail}
            actions={ctrData.actions}
            accent={ctrAccent}
          />
        </div>
      )}
    </div>
  );
}
