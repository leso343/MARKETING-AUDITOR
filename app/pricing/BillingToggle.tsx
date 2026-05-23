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
  const isAnnual = period === "annual";

  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      <span
        className={`text-sm font-mono transition-colors duration-300 ${
          !isAnnual ? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        Monthly
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        aria-label="Toggle annual billing"
        onClick={toggle}
        className={`
          relative h-8 w-[52px] rounded-full border
          transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]
          active:scale-95
          ${isAnnual
            ? "border-[var(--red)]/40 bg-[var(--red)]/15"
            : "border-[var(--border)] bg-[var(--card)]"
          }
        `}
      >
        {/* knob */}
        <span
          className={`
            absolute top-[3px] left-[3px] h-[26px] w-[26px] rounded-full
            bg-[var(--red)] shadow-[0_0_8px_rgba(255,0,0,0.3)]
            transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]
            ${isAnnual ? "translate-x-[20px]" : "translate-x-0"}
          `}
        />
      </button>

      <span
        className={`text-sm font-mono transition-colors duration-300 ${
          isAnnual ? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        Annual
      </span>

      {/* Save badge — always rendered, animated via opacity + scale */}
      <span
        className={`
          ml-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5
          text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider
          transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)]
          ${isAnnual
            ? "opacity-100 scale-100 translate-x-0"
            : "opacity-0 scale-75 -translate-x-2 pointer-events-none"
          }
        `}
      >
        Save 20%
      </span>
    </div>
  );
}
