"use client";

import type { GeographicWasteResult } from "@/engine/analyses/geographicWaste";

interface Props {
  geo: GeographicWasteResult;
}

const STATUS_BG: Record<string, string> = {
  hot: "rgba(74,222,128,0.10)",
  mixed: "rgba(251,191,36,0.10)",
  cold: "rgba(251,191,36,0.15)",
  leak: "rgba(255,0,0,0.15)",
};
const STATUS_TEXT: Record<string, string> = {
  hot: "#4ade80",
  mixed: "#fbbf24",
  cold: "#fbbf24",
  leak: "#ff0000",
};

export default function GeographicHeatmap({ geo }: Props) {
  const maxSpend = Math.max(...geo.regions.map((r) => r.spend), 1);

  return (
    <div className="panel h-full">
      <div className="panel-label">Geographic_Leakage_Audit</div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Mini label="Zones_Mapped" value={String(geo.zonesMapped)} />
        <Mini label="Core_Hot" value={`$${Math.round(geo.coreHotSpend).toLocaleString()}`} />
        <Mini
          label="Leakage_Out"
          value={`$${Math.round(geo.wasteUSD).toLocaleString()}`}
          tone="leak"
        />
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Region</th>
            <th className="text-right">Spend</th>
            <th className="text-right">Leads</th>
            <th className="text-right">CPL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {geo.regions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-[var(--text-dim)]">
                No DMA breakdown found. Drop a `breakdown_dma.csv` into the
                client folder.
              </td>
            </tr>
          )}
          {geo.regions.map((r) => {
            const widthPct = (r.spend / maxSpend) * 100;
            return (
              <tr
                key={r.name}
                className="relative"
                style={{
                  background: STATUS_BG[r.status],
                }}
              >
                <td className="font-mono text-xs font-bold">{r.name}</td>
                <td className="text-right font-mono">
                  ${r.spend.toLocaleString()}
                  <div className="mt-1 h-[2px] w-full bg-[#111]">
                    <div
                      className="h-full bg-[var(--red)]"
                      style={{ width: `${widthPct}%`, opacity: 0.5 }}
                    />
                  </div>
                </td>
                <td className="text-right font-mono">{r.conversions}</td>
                <td className="text-right font-mono">
                  {r.cpl > 0 ? `$${r.cpl.toFixed(2)}` : "—"}
                </td>
                <td>
                  <span
                    className="status-pill"
                    style={{ color: STATUS_TEXT[r.status] }}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="insight-box">
        <b>RECOMMENDATION:</b> {geo.recommendation}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "leak";
}) {
  return (
    <div className="border border-[var(--border)] bg-[#060606] px-3 py-2.5">
      <div
        className="font-mono text-base font-extrabold leading-none"
        style={{ color: tone === "leak" ? "var(--red)" : "#fff" }}
      >
        {value}
      </div>
      <div className="mt-1.5 font-mono text-[8px] uppercase tracking-[1.5px] text-[#444]">
        {label}
      </div>
    </div>
  );
}
