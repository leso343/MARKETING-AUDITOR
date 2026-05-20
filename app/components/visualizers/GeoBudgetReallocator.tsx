"use client";

/**
 * GeoBudgetReallocator
 *
 * Per-DMA row with a budget-share slider. Dragging one slider auto-rebalances
 * the others proportionally to keep the total at 100%. Live projection of
 * leads under the new allocation, computed as
 *
 *   projected_leads = Σ ( newSpend_dma / cpl_dma )
 *
 * where `cpl_dma` is the DMA's historical cost-per-lead from the audit.
 * DMAs with zero historical leads (cpl === 0) project zero new leads
 * regardless of allocation — they're flagged as "no signal".
 *
 * Reset returns to the engine's original share allocation.
 *
 * Hit targets ≥ 44px on touch; honours prefers-reduced-motion.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RotateCcw, TrendingUp, AlertCircle, Lock, Unlock } from "lucide-react";
import type { GeographicWasteResult, RegionStat } from "@/engine/analyses/geographicWaste";
import { useLang } from "@/context/LangContext";

interface Props {
  geo: GeographicWasteResult;
  /** Optional limit — only show top N DMAs by spend. Default = all. */
  maxRows?: number;
}

const RED = "#ff0000";
const GREEN = "#4ade80";
const AMBER = "#fbbf24";
const DIM = "#a0a0a0";

interface Allocation {
  name: string;
  /** % of total budget (0-100), sum across all = 100 */
  pct: number;
  /** $ historical cost-per-lead (0 means no leads recorded) */
  cpl: number;
  /** Original share for diffing */
  originalPct: number;
  /** Original projected leads at original allocation */
  originalLeads: number;
  /** User locked this row so rebalancing skips it */
  locked: boolean;
}

export default function GeoBudgetReallocator({ geo, maxRows }: Props) {
  const { t } = useLang();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  // Pick the DMAs we'll allocate across
  const seedRegions: RegionStat[] = useMemo(() => {
    const sorted = [...geo.regions].sort((a, b) => b.spend - a.spend);
    return maxRows ? sorted.slice(0, maxRows) : sorted;
  }, [geo.regions, maxRows]);

  const totalBudget = useMemo(
    () => seedRegions.reduce((acc, r) => acc + r.spend, 0),
    [seedRegions],
  );

  const buildInitial = (): Allocation[] => {
    if (totalBudget <= 0) {
      const eq = seedRegions.length ? 100 / seedRegions.length : 0;
      return seedRegions.map((r) => ({
        name: r.name,
        pct: eq,
        cpl: r.cpl,
        originalPct: eq,
        originalLeads: 0,
        locked: false,
      }));
    }
    return seedRegions.map((r) => {
      const pct = (r.spend / totalBudget) * 100;
      const leads = r.cpl > 0 ? r.spend / r.cpl : 0;
      return {
        name: r.name,
        pct,
        cpl: r.cpl,
        originalPct: pct,
        originalLeads: leads,
        locked: false,
      };
    });
  };

  const [alloc, setAlloc] = useState<Allocation[]>(buildInitial);

  // Reset when underlying data changes (e.g. industry switch upstream)
  useEffect(() => {
    setAlloc(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, maxRows]);

  /**
   * Set row `idx` to `newPct` and proportionally redistribute the delta
   * across all OTHER unlocked rows. Locked rows + the row being edited
   * keep their current value. If everyone else is locked we clamp.
   */
  const setRow = (idx: number, rawNewPct: number) => {
    setAlloc((prev) => {
      const newPct = Math.max(0, Math.min(100, rawNewPct));
      const oldPct = prev[idx].pct;
      const delta = newPct - oldPct;
      if (delta === 0) return prev;

      // Pool of OTHER unlocked rows that can absorb the delta
      const others = prev
        .map((r, i) => ({ r, i }))
        .filter(({ i, r }) => i !== idx && !r.locked);

      if (!others.length) {
        // Nothing to redistribute against — refuse the change
        return prev;
      }
      const othersTotal = others.reduce((a, { r }) => a + r.pct, 0);

      // If we need to take from others but they have nothing to give → clamp
      if (delta > 0 && othersTotal <= 0) return prev;

      const next = prev.map((r, i) => {
        if (i === idx) return { ...r, pct: newPct };
        if (r.locked) return r;
        if (othersTotal <= 0) {
          // Spread the delta evenly when others sum to zero
          const share = -delta / others.length;
          return { ...r, pct: Math.max(0, r.pct + share) };
        }
        const weight = r.pct / othersTotal;
        return { ...r, pct: Math.max(0, r.pct - delta * weight) };
      });

      // Normalise: floating-point error can drift the total. Scale unlocked
      // non-idx rows so the grand total lands on 100.
      const sum = next.reduce((a, r) => a + r.pct, 0);
      const drift = 100 - sum;
      if (Math.abs(drift) > 0.01) {
        const unlockedOthers = next
          .map((r, i) => ({ r, i }))
          .filter(({ i, r }) => i !== idx && !r.locked);
        const unlockedTotal = unlockedOthers.reduce((a, { r }) => a + r.pct, 0);
        if (unlockedTotal > 0) {
          for (const { i } of unlockedOthers) {
            next[i] = { ...next[i], pct: next[i].pct + drift * (next[i].pct / unlockedTotal) };
          }
        }
      }
      return next;
    });
  };

  const toggleLock = (idx: number) => {
    setAlloc((prev) => prev.map((r, i) => (i === idx ? { ...r, locked: !r.locked } : r)));
  };

  const reset = () => setAlloc(buildInitial());

  // Live projection
  const projection = useMemo(() => {
    let leads = 0;
    let originalLeads = 0;
    for (const r of alloc) {
      const newSpend = (r.pct / 100) * totalBudget;
      if (r.cpl > 0) leads += newSpend / r.cpl;
      originalLeads += r.originalLeads;
    }
    return {
      projectedLeads: Math.round(leads),
      originalLeads: Math.round(originalLeads),
      delta: Math.round(leads - originalLeads),
    };
  }, [alloc, totalBudget]);

  const isChanged = alloc.some((r) => Math.abs(r.pct - r.originalPct) > 0.1);
  const improving = projection.delta > 0;
  const transitionStyle: React.CSSProperties = reducedMotion
    ? { transition: "none" }
    : { transition: "width 180ms ease-out, color 180ms ease-out" };

  if (!seedRegions.length) {
    return (
      <div className="panel">
        <div className="panel-label">{t("Geo_Budget_Reallocator", "Move Your Budget Around")}</div>
        <div className="py-8 text-center text-xs text-[var(--text-dim)]">
          {t("No DMA breakdown available", "No location breakdown to reallocate.")}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-label">{t("Geo_Budget_Reallocator", "Move Your Budget Around")}</div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Shift budget between areas", "Move money between cities")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          `Total weekly-ish budget: $${Math.round(totalBudget).toLocaleString()}. Drag any slider — the others auto-rebalance to keep 100% allocated. Projection uses each area's current CPL.`,
          `You're spending about $${Math.round(totalBudget).toLocaleString()}. Move a slider — the rest adjust to keep your total spending the same. We estimate leads using each area's current cost per lead.`,
        )}
      </p>

      {/* Live readout header */}
      <div
        className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border border-[var(--border)] p-3"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            {t("Projected leads under this allocation", "Leads you'd get with this mix")}
          </div>
          <div
            className="text-3xl font-bold tabular-nums"
            style={{
              fontFamily: "var(--font-head)",
              color: !isChanged
                ? "var(--text)"
                : improving
                  ? GREEN
                  : projection.delta < 0
                    ? RED
                    : "var(--text)",
            }}
          >
            {projection.projectedLeads.toLocaleString()}
          </div>
          {isChanged && (
            <div
              className="font-mono text-[10px]"
              style={{ color: improving ? GREEN : projection.delta < 0 ? RED : DIM }}
            >
              {projection.delta > 0 ? "+" : ""}
              {projection.delta.toLocaleString()}{" "}
              {t(
                `vs current (${projection.originalLeads.toLocaleString()})`,
                `more than now (${projection.originalLeads.toLocaleString()})`,
              )}
            </div>
          )}
          {!isChanged && (
            <div className="font-mono text-[10px] text-[var(--text-dim)]">
              {t("(current allocation)", "(what you're doing now)")}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={!isChanged}
          aria-label={t("Reset allocation", "Reset")}
          className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ minHeight: 44, minWidth: 88 }}
        >
          <RotateCcw className="h-3 w-3" />
          {t("Reset", "Reset")}
        </button>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {alloc.map((row, idx) => {
          const newSpend = (row.pct / 100) * totalBudget;
          const projectedLeads = row.cpl > 0 ? newSpend / row.cpl : 0;
          const noSignal = row.cpl <= 0;
          const pctDelta = row.pct - row.originalPct;
          return (
            <div
              key={row.name}
              className="border border-[var(--border)] p-3"
              style={{
                background: row.locked ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.015)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: noSignal ? AMBER : DIM }}
                  />
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider text-[var(--text)] truncate"
                    title={row.name}
                  >
                    {row.name}
                  </span>
                  {noSignal && (
                    <span
                      className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                      style={{
                        borderColor: AMBER,
                        color: AMBER,
                        background: "rgba(251,191,36,0.08)",
                      }}
                    >
                      <AlertCircle className="h-2.5 w-2.5" />
                      {t("no signal", "no leads yet")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className="text-base font-bold tabular-nums leading-tight"
                      style={{
                        fontFamily: "var(--font-head)",
                        color:
                          Math.abs(pctDelta) < 0.1
                            ? "var(--text)"
                            : pctDelta > 0
                              ? GREEN
                              : RED,
                        ...transitionStyle,
                      }}
                    >
                      {row.pct.toFixed(1)}%
                    </div>
                    <div className="font-mono text-[9px] text-[var(--text-dim)] tabular-nums">
                      ${Math.round(newSpend).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleLock(idx)}
                    aria-label={
                      row.locked
                        ? t(`Unlock ${row.name}`, `Unlock ${row.name}`)
                        : t(`Lock ${row.name}`, `Lock ${row.name}`)
                    }
                    aria-pressed={row.locked}
                    className="flex items-center justify-center border border-[var(--border)] transition-colors hover:border-[var(--red)]"
                    style={{
                      width: 44,
                      height: 44,
                      color: row.locked ? GREEN : DIM,
                      background: row.locked ? "rgba(74,222,128,0.06)" : "transparent",
                    }}
                  >
                    {row.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={row.pct}
                  disabled={row.locked}
                  onChange={(e) => setRow(idx, Number(e.target.value))}
                  aria-label={t(
                    `${row.name} budget share slider`,
                    `${row.name} budget slider`,
                  )}
                  className="flex-1"
                  style={{
                    accentColor: row.locked ? GREEN : RED,
                    height: 32,
                    cursor: row.locked ? "not-allowed" : "pointer",
                    opacity: row.locked ? 0.5 : 1,
                  }}
                />
                <div className="text-right" style={{ minWidth: 92 }}>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                    {t("Projected", "Leads")}
                  </div>
                  <div
                    className="text-sm font-bold tabular-nums"
                    style={{
                      fontFamily: "var(--font-head)",
                      color: noSignal ? AMBER : "var(--text)",
                    }}
                  >
                    {noSignal ? "—" : Math.round(projectedLeads).toLocaleString()}
                  </div>
                  {row.cpl > 0 && (
                    <div className="font-mono text-[9px] text-[var(--text-dim)] tabular-nums">
                      @ ${row.cpl.toFixed(0)}/lead
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] text-[var(--text-dim)]">
        <TrendingUp
          className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
          style={{ color: improving ? GREEN : DIM }}
        />
        <span>
          {t(
            "Projection assumes each DMA's historical CPL stays constant. Areas with no historical leads project zero — they need a test budget before reallocation maths can predict them.",
            "We're assuming each city's cost per lead stays the same. Cities with no leads yet can't be predicted — they need a small test budget first.",
          )}
        </span>
      </div>
    </div>
  );
}
