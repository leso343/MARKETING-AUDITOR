"use client";

import { useState } from "react";
import { Settings2, Loader2, Languages, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { useLang } from "@/context/LangContext";

import type { ReportingPeriod } from "@/engine/runAudit";

interface Props {
  targetCpl: number;
  targetCtr: number;
  originalCpl: number;
  originalCtr: number;
  onLiveCpl: (v: number) => void;
  onLiveCtr: (v: number) => void;
  industry: string;
  industryOptions: { key: string; label: string }[];
  onChange: (key: string, value: string | null) => void;
  onBatchChange: (updates: Record<string, string | null>) => void;
  isPending: boolean;
  onReset: () => void;
  reportingPeriod: ReportingPeriod;
}

const TIME_WINDOWS = [
  { key: "7",   label: "Last 7 days" },
  { key: "30",  label: "Last 30 days" },
  { key: "90",  label: "Last 90 days" },
  { key: "all", label: "All time" },
];

export default function ControlsPanel({
  targetCpl,
  targetCtr,
  originalCpl,
  originalCtr,
  onLiveCpl,
  onLiveCtr,
  industry,
  industryOptions,
  onChange,
  onBatchChange,
  isPending,
  onReset,
  reportingPeriod,
}: Props) {
  const { t, plain, toggle } = useLang();
  const [timeWindow, setTimeWindow] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);

  const cplModified = targetCpl !== originalCpl;
  const ctrModified = targetCtr !== originalCtr;
  const anyModified = cplModified || ctrModified;

  // The controls content is shared between desktop sidebar and mobile sheet
  const controlsContent = (
      <div className="px-6 py-9">
        <div className="mb-6 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--red)]" />
          <div
            className="text-sm font-bold uppercase tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {t("Live Controls", "Live Controls")}
          </div>
          {isPending && (
            <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[var(--red)]" />
          )}
        </div>

        {/* Language toggle */}
        <div className="mb-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
            {t("Language Mode", "Language Mode")}
          </label>
          <button
            onClick={toggle}
            className="flex w-full items-center justify-between border px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
            style={{
              borderColor: plain ? "#4ade80" : "var(--red-dim)",
              background: plain ? "rgba(74,222,128,0.05)" : "rgba(255,0,0,0.05)",
              color: plain ? "#4ade80" : "var(--red)",
            }}
          >
            <div className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5" />
              {plain ? "Plain English" : "Agency Mode"}
            </div>
            <span className="text-[8px] opacity-60">click to switch</span>
          </button>
          <div className="mt-1.5 font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
            {plain
              ? "Simple language — no jargon"
              : "Professional marketing terminology"}
          </div>
        </div>

        {/* Industry */}
        <div className="mb-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
            {t("Industry Benchmark", "Your industry")}
          </label>
          <select
            className="dark-select"
            value={industry}
            onChange={(e) => {
              // Single batched replace — prevents the three individual calls from clobbering each other
              onBatchChange({ industry: e.target.value, cpl: null, ctr: null });
            }}
          >
            {industryOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target CPL */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
              {t("Target CPL", "Cost per lead goal")}
            </label>
            <div className="flex items-baseline gap-1.5">
              {cplModified && (
                <span className="font-mono text-[9px] text-[var(--text-dim)] line-through opacity-50">
                  ${originalCpl}
                </span>
              )}
              <span className="font-mono text-sm font-bold" style={{ color: cplModified ? "#fbbf24" : "var(--red)" }}>
                ${targetCpl}
              </span>
            </div>
          </div>
          <input
            type="range"
            className="range-input"
            min={20}
            max={200}
            step={5}
            value={targetCpl}
            onChange={(e) => onLiveCpl(Number(e.target.value))}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-dim)]">
            <span>$20</span>
            <span>$200</span>
          </div>
          {cplModified && (
            <div className="mt-1 font-mono text-[8px] text-[#fbbf24] opacity-70">
              WHAT-IF — original: ${originalCpl}
            </div>
          )}
        </div>

        {/* Target CTR */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
              {t("Target CTR", "Click rate goal")}
            </label>
            <div className="flex items-baseline gap-1.5">
              {ctrModified && (
                <span className="font-mono text-[9px] text-[var(--text-dim)] line-through opacity-50">
                  {originalCtr.toFixed(1)}%
                </span>
              )}
              <span className="font-mono text-sm font-bold" style={{ color: ctrModified ? "#fbbf24" : "var(--red)" }}>
                {targetCtr.toFixed(1)}%
              </span>
            </div>
          </div>
          <input
            type="range"
            className="range-input"
            min={0.5}
            max={5}
            step={0.1}
            value={targetCtr}
            onChange={(e) => onLiveCtr(Number(e.target.value))}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-dim)]">
            <span>0.5%</span>
            <span>5.0%</span>
          </div>
          {ctrModified && (
            <div className="mt-1 font-mono text-[8px] text-[#fbbf24] opacity-70">
              WHAT-IF — original: {originalCtr.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Reset button — shown when in what-if mode */}
        {(cplModified || ctrModified) && (
          <button
            type="button"
            onClick={onReset}
            className="mb-6 w-full border border-[#fbbf2440] py-2 font-mono text-[9px] uppercase tracking-wider text-[#fbbf24] transition-colors hover:border-[#fbbf24] hover:bg-[rgba(251,191,36,0.08)]"
          >
            {t("← Reset to original analysis", "← Go back to your real numbers")}
          </button>
        )}

        {/* Time window */}
        <div className="mb-6">
          <label className="mb-2 block font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
            {t("Time Window", "Dates to look at")}
          </label>
          <select
            className="dark-select"
            value={timeWindow}
            onChange={(e) => {
              setTimeWindow(e.target.value);
              onChange("days", e.target.value === "all" ? null : e.target.value);
            }}
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>

          {/* Reporting period context */}
          {reportingPeriod.totalDays > 0 && (
            <div className="mt-2 space-y-1">
              <div className="font-mono text-[8px] text-[var(--text-dim)]">
                Export: {reportingPeriod.startDate} → {reportingPeriod.endDate}
                <span className="ml-1 opacity-60">({reportingPeriod.totalDays}d)</span>
              </div>
              {reportingPeriod.isScaled ? (
                <div className="font-mono text-[8px]" style={{ color: "#fbbf24" }}>
                  ⚡ Scaled to est. {reportingPeriod.filterDays}d
                  <span className="opacity-60"> ({(reportingPeriod.scaleFactor * 100).toFixed(0)}% of export)</span>
                </div>
              ) : (
                <div className="font-mono text-[8px] text-[var(--text-dim)] opacity-60">
                  Showing full {reportingPeriod.totalDays}-day export
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-[var(--border)] pt-4 font-mono text-[8px] uppercase tracking-wider text-[var(--text-dim)]">
          {t(
            "CPL/CTR sliders are what-if tools — drag to explore, reset to return to original data.",
            "Slide to explore scenarios. Original data is always preserved — hit Reset to go back.",
          )}
        </div>
      </div>
  ); // end controlsContent

  return (
    <>
      {/* ── Desktop sidebar (xl+) ─────────────────────────────────── */}
      <aside
        className="hidden w-[280px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--sidebar)] xl:flex xl:flex-col"
        style={{ height: "100vh", overflowY: "auto" }}
      >
        {controlsContent}
      </aside>

      {/* ── Mobile: floating pill + bottom sheet (below xl) ──────── */}
      <div className="xl:hidden">
        {/* Floating pill — always visible at bottom right */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg transition-all"
          style={{
            background: anyModified ? "rgba(251,191,36,0.12)" : "rgba(6,6,6,0.95)",
            borderColor: anyModified ? "rgba(251,191,36,0.6)" : "rgba(255,0,0,0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <SlidersHorizontal
            className="h-3.5 w-3.5"
            style={{ color: anyModified ? "#fbbf24" : "var(--red)" }}
          />
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ color: anyModified ? "#fbbf24" : "var(--red)" }}
          >
            {anyModified ? `$${targetCpl} CPL · ${targetCtr.toFixed(1)}% CTR` : "Live Controls"}
          </span>
          {isPending && <Loader2 className="h-3 w-3 animate-spin text-[var(--red)]" />}
          {anyModified && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
          )}
        </button>

        {/* Bottom sheet backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Bottom sheet drawer */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-[var(--border)] bg-[var(--sidebar)] transition-transform duration-300"
          style={{
            transform: mobileOpen ? "translateY(0)" : "translateY(100%)",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          {/* Drag handle */}
          <div className="flex items-center justify-between px-6 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[var(--red)]" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                Live Controls
              </span>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--red)]" />}
            </div>
            <div className="flex items-center gap-2">
              {anyModified && (
                <button
                  onClick={() => { onReset(); setMobileOpen(false); }}
                  className="flex items-center gap-1 border border-[#fbbf2440] px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-[#fbbf24]"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Reset
                </button>
              )}
              <button
                onClick={() => setMobileOpen(false)}
                className="border border-[var(--border)] p-1.5 text-[var(--text-dim)] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />

          {/* Controls content reuses same JSX as desktop */}
          {controlsContent}
        </div>
      </div>
    </>
  );
}
