"use client";

/**
 * ReportFunnel — narrative funnel SVG modeled on the original report's
 * "X people dropped off" diagram. Renders three sized rectangles:
 *
 *     [  CLICKS PAID FOR · N  ]                         (top, wide)
 *           ╲                ╱
 *             trapezoid w/ "X dropped off"  caption
 *           ╱                ╲
 *      [  REACHED WEBSITE · M  ]                        (mid, narrower)
 *
 * All numbers are pulled from `funnel` so the chart reflects the
 * currently loaded audit — no hardcoded values.
 */

import type { FunnelLeakageResult } from "@/engine/analyses/funnelLeakage";

interface Props {
  funnel: FunnelLeakageResult;
}

export default function ReportFunnel({ funnel }: Props) {
  const clicks = funnel.totalClicks ?? 0;
  const arrived = funnel.estimatedSessions ?? 0;
  const dropped = Math.max(clicks - arrived, 0);
  const lossPct = funnel.clickToSessionLossPct ?? 0;

  // Trapezoid width ratio — arrived / clicks, clamped.
  const ratio = clicks > 0 ? Math.min(Math.max(arrived / clicks, 0.08), 1) : 0.5;
  const VIEWBOX_W = 520;
  const TOP_W = 520;
  const BOT_W = Math.round(TOP_W * ratio);
  const BOT_X = Math.round((TOP_W - BOT_W) / 2);

  return (
    <div className="report-chart-card">
      <div className="report-chart-card__title">Click-to-Site Funnel</div>

      {/* Headline + lead copy above the SVG */}
      <div className="report-funnel-headline">
        <div className="report-funnel-headline__stat">
          <div className="report-funnel-headline__pct">{lossPct.toFixed(1)}%</div>
          <div className="report-funnel-headline__lbl">CLICK DROP-OFF</div>
        </div>
        <p className="report-funnel-headline__copy">
          Out of every <strong>{clicks.toLocaleString()} clicks paid for</strong>, only{" "}
          <strong>{arrived.toLocaleString()} people actually reached the website</strong>.
          The current funnel is losing visitors before they ever see the page.
        </p>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_W} 108`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block", marginTop: 10 }}
      >
        <defs>
          <linearGradient id="rfSoft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--red)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="rfTrap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="rfDeep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1f0a0a" />
            <stop offset="100%" stopColor="#3b1414" />
          </linearGradient>
        </defs>

        {/* Top bar — clicks paid for */}
        <rect x="0" y="8" width={TOP_W} height="28" rx="4"
          fill="url(#rfSoft)" stroke="var(--red)" strokeOpacity="0.6" strokeWidth="1" />
        <text x="14" y="20" fontFamily="ui-monospace, monospace" fontSize="8"
          fill="rgba(255,255,255,0.65)" fontWeight="800" letterSpacing="1.4">
          CLICKS PAID FOR
        </text>
        <text x="14" y="32" fontFamily="var(--font-head)" fontSize="13"
          fill="var(--text)" fontWeight="900" letterSpacing="-0.3">
          Ad Clicks
        </text>
        <text x={TOP_W - 14} y="32" fontFamily="var(--font-head)" fontSize="20"
          fill="var(--text)" fontWeight="900" textAnchor="end" letterSpacing="-0.8">
          {clicks.toLocaleString()}
        </text>

        {/* Trapezoid */}
        <polygon points={`0,36 ${TOP_W},36 ${BOT_X + BOT_W},72 ${BOT_X},72`} fill="url(#rfTrap)" />
        <line x1="0" y1="36" x2={BOT_X} y2="72" stroke="var(--red)" strokeWidth="0.6"
          strokeDasharray="3 2" opacity="0.65" />
        <line x1={TOP_W} y1="36" x2={BOT_X + BOT_W} y2="72" stroke="var(--red)" strokeWidth="0.6"
          strokeDasharray="3 2" opacity="0.65" />
        <text x={TOP_W / 2} y="56" fontFamily="var(--font-head)" fontSize="13"
          fill="var(--text)" fontWeight="900" textAnchor="middle" letterSpacing="-0.3">
          {dropped.toLocaleString()} People Dropped Off
        </text>
        <text x={TOP_W / 2} y="68" fontFamily="ui-monospace, monospace" fontSize="7"
          fill="#EF4444" fontWeight="800" textAnchor="middle" letterSpacing="1.3">
          LOST BEFORE THE SITE LOADED
        </text>

        {/* Bottom bar — arrived */}
        <rect x={BOT_X} y="72" width={BOT_W} height="28" rx="4"
          fill="url(#rfDeep)" stroke="var(--red)" strokeWidth="1.2" />
        <text x={BOT_X + 12} y="84" fontFamily="ui-monospace, monospace" fontSize="7"
          fill="rgba(255,255,255,0.7)" fontWeight="800" letterSpacing="1.4">
          ACTUALLY ARRIVED
        </text>
        <text x={BOT_X + 12} y="96" fontFamily="var(--font-head)" fontSize="12"
          fill="var(--text)" fontWeight="900" letterSpacing="-0.3">
          Reached Website
        </text>
        <text x={BOT_X + BOT_W - 12} y="96" fontFamily="var(--font-head)" fontSize="18"
          fill="var(--text)" fontWeight="900" textAnchor="end" letterSpacing="-0.8">
          {arrived.toLocaleString()}
        </text>
      </svg>

      <div className="report-chart-card__caption">
        {funnel.landingPageViewsAvailable ? (
          <>Based on <strong>real landing-page-view data</strong> from your CSV exports.</>
        ) : (
          <>Landing-page-view column not present — arrival counts are <strong>estimated</strong> from click and impression data.</>
        )}
      </div>
    </div>
  );
}
