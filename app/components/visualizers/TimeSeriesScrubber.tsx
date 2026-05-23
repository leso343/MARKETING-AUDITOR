"use client";

/**
 * TimeSeriesScrubber
 *
 * Weekly CPL line chart with a draggable scrubber handle. Hovering or
 * dragging the handle shows what was running that week — ad set names,
 * spend, lead count. Weeks with CPL > 2x median get a red anomaly dot.
 *
 * Built on recharts (already a project dependency). The scrubber handle
 * is a custom div overlay so we get full pointer/touch control independent
 * of the recharts Brush widget. Pointer Events API gives us a single
 * code path for mouse + touch.
 *
 * Respects prefers-reduced-motion (skips animation on the marker).
 * Hit target on the scrubber thumb is 44px wide.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { Calendar, AlertTriangle, DollarSign, Users } from "lucide-react";
import { useLang } from "@/context/LangContext";

export interface WeekPoint {
  /** ISO week label like "2025-W14" or "Apr 1 – Apr 7" */
  weekLabel: string;
  /** CPL for that week ($ / lead). 0 means no leads. */
  cpl: number;
  /** Total ad spend that week */
  spend: number;
  /** Lead form submissions that week */
  leads: number;
  /** Names of ad sets that ran that week (deduplicated) */
  activeAdSets: string[];
}

interface Props {
  weeks: WeekPoint[];
  /** Optional: override anomaly threshold (default = 2x median CPL) */
  anomalyMultiplier?: number;
}

const RED = "#ff0000";
const GREEN = "#4ade80";
const AMBER = "#fbbf24";
const DIM = "#a0a0a0";

export default function TimeSeriesScrubber({
  weeks,
  anomalyMultiplier = 2,
}: Props) {
  const { t } = useLang();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  // Anomaly detection: median of non-zero CPLs, flag weeks > 2x that
  const { median, anomalyThreshold, anomalyIdxs } = useMemo(() => {
    const cpls = weeks.map((w) => w.cpl).filter((v) => v > 0).sort((a, b) => a - b);
    const m = cpls.length ? cpls[Math.floor(cpls.length / 2)] : 0;
    const threshold = m * anomalyMultiplier;
    const idxs = new Set<number>();
    weeks.forEach((w, i) => {
      if (m > 0 && w.cpl > threshold) idxs.add(i);
    });
    return { median: m, anomalyThreshold: threshold, anomalyIdxs: idxs };
  }, [weeks, anomalyMultiplier]);

  // Drag/touch handling via Pointer Events
  const updateFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el || weeks.length <= 1) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const idx = Math.round(ratio * (weeks.length - 1));
    setActiveIdx(idx);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Keyboard support
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
    else if (e.key === "ArrowRight")
      setActiveIdx((i) => Math.min(weeks.length - 1, i + 1));
    else if (e.key === "Home") setActiveIdx(0);
    else if (e.key === "End") setActiveIdx(weeks.length - 1);
    else return;
    e.preventDefault();
  };

  const active = weeks[activeIdx];
  const isAnomaly = anomalyIdxs.has(activeIdx);
  const handleLeftPct = weeks.length <= 1 ? 0 : (activeIdx / (weeks.length - 1)) * 100;

  // Empty state
  if (!weeks.length) {
    return (
      <div className="panel">
        <div className="panel-label">
          {t("Weekly_CPL_Trend", "Cost Per Lead, Week by Week")}
        </div>
        <div className="py-8 text-center text-xs text-[var(--text-dim)]">
          {t("No weekly data available", "Not enough weekly data to show a trend.")}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-label">
        {t("Weekly_CPL_Trend", "Cost Per Lead, Week by Week")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Scrub the timeline", "Drag the slider to see what was running each week")}
      </h2>
      <p className="mb-4 text-xs text-[var(--text-dim)]">
        {t(
          `Median CPL across the window: $${median.toFixed(2)}. Red dots flag weeks above ${anomalyMultiplier}× median.`,
          `Your typical cost per lead is about $${median.toFixed(0)}. Red dots mark weeks where it spiked.`,
        )}
      </p>

      {/* Chart */}
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart
            data={weeks.map((w, i) => ({ ...w, idx: i, anomaly: anomalyIdxs.has(i) }))}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: DIM, fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: DIM, fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              tickFormatter={(v: number) => `$${Math.round(v)}`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--text)" }}
              formatter={(value: number) => [`$${Number(value).toFixed(2)}`, t("CPL", "Cost per lead")]}
            />
            {median > 0 && (
              <ReferenceLine
                y={median}
                stroke={DIM}
                strokeDasharray="3 3"
                label={{
                  value: t("median", "typical"),
                  position: "right",
                  fill: DIM,
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="cpl"
              stroke={RED}
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
              animationDuration={reducedMotion ? 0 : 400}
              dot={(props: { cx?: number; cy?: number; payload?: { anomaly?: boolean; idx?: number } }) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined || !payload) {
                  // Recharts dot needs an SVG element fallback
                  return <circle cx={0} cy={0} r={0} fill="transparent" />;
                }
                const isActive = payload.idx === activeIdx;
                const r = payload.anomaly ? 5 : isActive ? 4 : 0;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={payload.anomaly ? RED : isActive ? "#fff" : "transparent"}
                    stroke={payload.anomaly ? "#fff" : RED}
                    strokeWidth={payload.anomaly ? 1 : 2}
                  />
                );
              }}
              activeDot={{ r: 5, fill: "#fff", stroke: RED, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Scrubber track */}
      <div className="mt-2 px-1">
        <div
          ref={trackRef}
          role="slider"
          aria-label={t("Week scrubber", "Drag to pick a week")}
          aria-valuemin={0}
          aria-valuemax={weeks.length - 1}
          aria-valuenow={activeIdx}
          aria-valuetext={active.weekLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative"
          style={{
            height: 44, // mobile-friendly hit area
            cursor: "ew-resize",
            touchAction: "none",
          }}
        >
          {/* Track line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 2,
              background: "var(--border)",
              transform: "translateY(-1px)",
            }}
          />
          {/* Tick marks */}
          {weeks.map((_w, i) => {
            const left = weeks.length <= 1 ? 0 : (i / (weeks.length - 1)) * 100;
            const isA = anomalyIdxs.has(i);
            return (
              <div
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: "50%",
                  width: 2,
                  height: isA ? 12 : 6,
                  background: isA ? RED : DIM,
                  transform: "translate(-1px, -50%)",
                  borderRadius: 1,
                  opacity: isA ? 1 : 0.5,
                }}
              />
            );
          })}
          {/* Handle */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${handleLeftPct}%`,
              top: "50%",
              width: 16,
              height: 28,
              background: isAnomaly ? RED : "#fff",
              border: `2px solid ${isAnomaly ? "#fff" : RED}`,
              transform: "translate(-50%, -50%)",
              transition: reducedMotion ? "none" : "left 80ms ease-out",
              boxShadow: "0 0 8px rgba(255,0,0,0.4)",
            }}
          />
        </div>
      </div>

      {/* Context card for the selected week */}
      <div
        className="mt-4 border border-[var(--border)] p-4"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-dim)]" />
            <span
              className="text-lg font-bold"
              style={{ fontFamily: "var(--font-head)" }}
            >
              {active.weekLabel}
            </span>
            {isAnomaly && (
              <span
                className="flex items-center gap-1 border border-[var(--red)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                style={{ color: RED, background: "rgba(255,0,0,0.08)" }}
              >
                <AlertTriangle className="h-3 w-3" />
                {t("anomaly", "spike")}
              </span>
            )}
          </div>
          <div
            className="text-3xl font-bold tabular-nums"
            style={{
              fontFamily: "var(--font-head)",
              color: isAnomaly ? RED : active.cpl <= median ? GREEN : AMBER,
            }}
          >
            ${active.cpl.toFixed(2)}
            <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              {t("CPL", "per lead")}
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                {t("Spend", "Spent")}
              </div>
              <div
                className="text-base font-bold tabular-nums"
                style={{ fontFamily: "var(--font-head)" }}
              >
                ${Math.round(active.spend).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                {t("Leads", "Leads")}
              </div>
              <div
                className="text-base font-bold tabular-nums"
                style={{ fontFamily: "var(--font-head)" }}
              >
                {active.leads.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        {active.activeAdSets.length > 0 && (
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
              {t("Ad sets running", "Ads running that week")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {active.activeAdSets.slice(0, 6).map((n) => (
                <span
                  key={n}
                  className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] text-[var(--text)]"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  {n}
                </span>
              ))}
              {active.activeAdSets.length > 6 && (
                <span className="px-2 py-1 font-mono text-[10px] text-[var(--text-dim)]">
                  +{active.activeAdSets.length - 6}
                </span>
              )}
            </div>
          </div>
        )}
        {anomalyThreshold > 0 && isAnomaly && (
          <div className="mt-3 text-[11px] text-[var(--text-dim)]">
            {t(
              `CPL this week was ${(active.cpl / median).toFixed(1)}× the median ($${median.toFixed(2)}). Check ad-set rotation, frequency, or pixel events for this period.`,
              `This week cost about ${(active.cpl / median).toFixed(1)}× more than your typical week. Worth checking what changed.`,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
