"use client";

/**
 * Report primitives — the small reusable building blocks that give the
 * report its distinct executive-presentation feel, modeled on
 * public/campaign_report.html:
 *
 *   ReportHero          — red badge pill + h1 + lead paragraph
 *   ReportSecTitle      — section heading with red square accent
 *   ReportStatCard      — top-bordered stat with label + value
 *   ReportStatGrid      — 3-up wrapper for ReportStatCard
 *   ReportInsightBox    — red-left-border callout with severity icon
 *   ReportTable         — narrative table with thead/tbody slots
 *   ReportRoadmapPhase  — red-left-border phase block with bullets
 *   ReportLadder        — vertical metric ladder with active row
 *
 * All styling lives in app/globals.css under .report-* selectors so the
 * agency-branding CSS variables flow through (--red, --card, --border).
 */

import type { ReactNode } from "react";

/* ── Hero ──────────────────────────────────────────────────────────── */
export function ReportHero({
  badge,
  title,
  titleHighlight,
  lead,
}: {
  badge: string;
  title: string;
  /** Optional second-half of the title rendered in red. */
  titleHighlight?: string;
  lead: string;
}) {
  return (
    <section className="report-hero">
      <div className="report-badge">{badge}</div>
      <h1 className="report-h1">
        {title}
        {titleHighlight && <> <span className="report-h1__highlight">{titleHighlight}</span></>}
      </h1>
      <p className="report-lead">{lead}</p>
    </section>
  );
}

/* ── Section title ─────────────────────────────────────────────────── */
export function ReportSecTitle({ children }: { children: ReactNode }) {
  return <h2 className="report-sec-title">{children}</h2>;
}

/* ── Stat card + grid ──────────────────────────────────────────────── */
export function ReportStatCard({
  label,
  value,
  caption,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  /** Highlights the top border in agency red. */
  accent?: boolean;
}) {
  return (
    <div className={`report-stat-card ${accent ? "report-stat-card--accent" : ""}`}>
      <div className="report-stat-card__label">{label}</div>
      <div className="report-stat-card__value">{value}</div>
      {caption && <div className="report-stat-card__caption">{caption}</div>}
    </div>
  );
}

export function ReportStatGrid({ children }: { children: ReactNode }) {
  return <div className="report-stat-grid">{children}</div>;
}

/* ── Insight box ───────────────────────────────────────────────────── */
export function ReportInsightBox({
  severity = "warning",
  title,
  children,
}: {
  severity?: "info" | "warning" | "critical" | "success";
  title: string;
  children: ReactNode;
}) {
  const icon = {
    info: "ⓘ",
    warning: "⚠",
    critical: "✖",
    success: "✓",
  }[severity];

  return (
    <aside className={`report-insight report-insight--${severity}`}>
      <h4 className="report-insight__title">
        <span className="report-insight__icon" aria-hidden="true">{icon}</span>
        {title}
      </h4>
      <div className="report-insight__body">{children}</div>
    </aside>
  );
}

/* ── Table ─────────────────────────────────────────────────────────── */
export function ReportTable({
  headers,
  rows,
  caption,
}: {
  headers: string[];
  /** Each row is an array of cells matching the headers length. */
  rows: ReactNode[][];
  caption?: ReactNode;
}) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <div className="report-table__caption">{caption}</div>}
    </div>
  );
}

/* ── Roadmap phase ─────────────────────────────────────────────────── */
export function ReportRoadmapPhase({
  index,
  title,
  duration,
  items,
}: {
  /** "1" / "2" / "3" — small number in the corner. */
  index: number | string;
  title: string;
  duration?: string;
  items: ReactNode[];
}) {
  return (
    <div className="report-roadmap-phase">
      <div className="report-roadmap-phase__head">
        <div className="report-roadmap-phase__title">
          <span className="report-roadmap-phase__index">{index}</span>
          {title}
        </div>
        {duration && <span className="report-roadmap-phase__duration">{duration}</span>}
      </div>
      <ul className="report-roadmap-phase__list">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── Verdict tag (inline pill — win/loss/neutral) ──────────────────── */
export function ReportTag({
  variant,
  children,
}: {
  variant: "win" | "loss" | "warning" | "neutral";
  children: ReactNode;
}) {
  return <span className={`report-tag report-tag--${variant}`}>{children}</span>;
}
