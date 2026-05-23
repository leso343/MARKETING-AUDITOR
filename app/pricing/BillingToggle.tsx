"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

type Period = "monthly" | "annual";

const BillingCtx = createContext<{
  period: Period;
  toggle: () => void;
}>({ period: "monthly", toggle: () => {} });

export function useBillingPeriod() {
  return useContext(BillingCtx);
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("monthly");
  return (
    <BillingCtx.Provider value={{ period, toggle: () => setPeriod((p) => (p === "monthly" ? "annual" : "monthly")) }}>
      {children}
    </BillingCtx.Provider>
  );
}

export default function BillingToggle() {
  const { period, toggle } = useBillingPeriod();
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      <span
        className={`text-sm font-mono transition-colors ${
          period === "monthly" ? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        Monthly
      </span>
      <button
        type="button"
        onClick={toggle}
        className="relative h-7 w-14 rounded-full border border-[var(--border)] bg-[var(--card)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)]"
        aria-label="Toggle billing period"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--red)] transition-transform duration-200 ${
            period === "annual" ? "translate-x-[30px]" : "translate-x-[3px]"
          }`}
        />
      </button>
      <span
        className={`text-sm font-mono transition-colors ${
          period === "annual" ? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        Annual
      </span>
      {period === "annual" && (
        <span className="ml-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider">
          Save 20%
        </span>
      )}
    </div>
  );
}
