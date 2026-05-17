"use client";

import type { KpiCard } from "@/engine/types";

interface Props {
  kpis: KpiCard[];
}

const STATUS_DOT: Record<string, string> = {
  ok: "#4ade80",
  warn: "#fbbf24",
  critical: "#ff0000",
};

export default function KPISnapshot({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="relative border border-[var(--border)] bg-[var(--card)] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--text-dim)]">
              {k.label}
            </div>
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: STATUS_DOT[k.status] ?? "#666" }}
            />
          </div>
          <div className="stat-val">{k.value}</div>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            {k.unit}
          </div>
          <div className="mt-3 border-t border-[var(--border)] pt-2 font-mono text-[9px] text-[var(--text-dim)]">
            {k.benchmark}
          </div>
        </div>
      ))}
    </div>
  );
}
