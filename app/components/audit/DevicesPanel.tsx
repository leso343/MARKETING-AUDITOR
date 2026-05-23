"use client";

import type { DeviceResult, DeviceScore } from "@/engine/analyses/deviceAnalysis";
import { useLang } from "@/context/LangContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  devices: DeviceResult;
}

const SCORE_COLOR: Record<DeviceScore, string> = {
  winner: "#4ade80",
  acceptable: "#fbbf24",
  underperforming: "#f97316",
  wasting: "#ff0000",
};

const DEVICE_COLOR: Record<string, string> = {
  mobile: "#8b5cf6",
  desktop: "#3b82f6",
  tablet: "#f59e0b",
  other: "#6b7280",
};

function deviceColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(DEVICE_COLOR)) {
    if (lower.includes(key)) return color;
  }
  return "#6b7280";
}

const SCORE_LABEL_PRO: Record<DeviceScore, string> = {
  winner: "WINNER",
  acceptable: "OK",
  underperforming: "WEAK",
  wasting: "WASTING",
};

const SCORE_LABEL_PLAIN: Record<DeviceScore, string> = {
  winner: "GREAT",
  acceptable: "OKAY",
  underperforming: "POOR",
  wasting: "LOSING $",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeviceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
      <div style={{ color: "var(--text-dim)", marginBottom: 2 }}>{d.name}</div>
      <div>${d.spend.toLocaleString()} · {d.results} leads</div>
      <div style={{ color: "var(--text-dim)", fontSize: 9 }}>
        {d.cpl > 0 ? `$${d.cpl.toFixed(2)}/lead` : "No conversions"} · {d.ctr.toFixed(1)}% CTR
      </div>
    </div>
  );
}

export default function DevicesPanel({ devices }: Props) {
  const { t, plain } = useLang();

  const hasData = devices.devices.length > 0;
  const chartData = devices.devices.filter((d) => d.spend > 0);

  return (
    <div className="panel h-full">
      <div className="panel-label">
        {t("Device_Breakdown", "Which devices")}
      </div>
      <h2
        className="mb-1 text-2xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {t("Device × CPL", "Mobile vs Desktop performance")}
      </h2>
      <p className="mb-5 text-xs text-[var(--text-dim)]">
        {t(
          "Spend and CPL by device type. Use this to adjust device bid modifiers.",
          "How well your ads perform on different device types.",
        )}
      </p>

      {!hasData ? (
        <div className="border border-[var(--border)] p-4 text-xs text-[var(--text-dim)]">
          {t(
            "No device breakdown data. Export a device breakdown from Meta Ads Manager.",
            "No device data found. Import a device breakdown to see this section.",
          )}
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="mb-5 flex items-center gap-4">
              <div style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="spend"
                      nameKey="name"
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={deviceColor(entry.name)} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip content={<DeviceTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {chartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: deviceColor(d.name) }}
                    />
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">{d.name}</span>
                    <span className="font-mono text-[10px] font-bold text-[var(--text)]">
                      {devices.totalSpend > 0
                        ? `${((d.spend / devices.totalSpend) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="data-table" style={{ minWidth: "380px" }}>
              <thead>
                <tr>
                  <th>{t("Device", "Type")}</th>
                  <th className="text-right">{t("Spend", "Spent")}</th>
                  <th className="text-right">{t("Leads", "Leads")}</th>
                  <th className="text-right">{t("CPL", "Cost/Lead")}</th>
                  <th className="text-right">{t("CTR", "Click Rate")}</th>
                  <th>{t("Score", "Rating")}</th>
                </tr>
              </thead>
              <tbody>
                {devices.devices.map((d) => {
                  const color = SCORE_COLOR[d.score];
                  const label = plain ? SCORE_LABEL_PLAIN[d.score] : SCORE_LABEL_PRO[d.score];
                  return (
                    <tr
                      key={d.name}
                      style={{
                        background:
                          d.score === "winner"
                            ? "rgba(74,222,128,0.06)"
                            : d.score === "wasting"
                              ? "rgba(255,0,0,0.08)"
                              : "transparent",
                      }}
                    >
                      <td className="font-mono text-xs font-bold">{d.name}</td>
                      <td className="text-right font-mono text-xs">
                        ${d.spend.toLocaleString()}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {d.results > 0 ? d.results : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {d.cpl > 0 ? `$${d.cpl.toFixed(2)}` : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {d.ctr > 0 ? `${d.ctr.toFixed(1)}%` : "—"}
                      </td>
                      <td>
                        <span className="status-pill" style={{ color }}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {devices.totalWaste > 0 && (
            <div className="insight-box mt-4">
              <b>{t("WASTE DETECTED:", "MONEY BEING WASTED:")}</b>{" "}
              ${devices.totalWaste.toLocaleString()}{" "}
              {t(
                "on underperforming devices. " + devices.recommendation,
                "on devices that aren't working. " + devices.recommendation,
              )}
            </div>
          )}

          {devices.totalWaste === 0 && (
            <div className="insight-box mt-4">
              <b>{t("ALL CLEAR:", "LOOKS GOOD:")}</b>{" "}
              {t(devices.recommendation, devices.recommendation)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
