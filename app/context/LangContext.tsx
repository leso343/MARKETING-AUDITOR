"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

type Mode = "pro" | "plain";

const Ctx = createContext<{ mode: Mode; toggle: () => void }>({
  // Default mode matches LangProvider's initial state (plain). The provider
  // also reads localStorage on mount and may switch to "pro" if the user
  // chose it last session — see useEffect below.
  mode: "plain",
  toggle: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("plain");

  useEffect(() => {
    // Default is plain English on first visit. Only switch to pro if the
    // user explicitly chose it last session (persisted in localStorage).
    const saved = localStorage.getItem("sna-lang") as Mode | null;
    if (saved === "pro") setMode("pro");
    else if (saved === "plain") setMode("plain");
  }, []);

  const toggle = () => {
    setMode((m) => {
      const next = m === "pro" ? "plain" : "pro";
      localStorage.setItem("sna-lang", next);
      return next;
    });
  };

  return <Ctx.Provider value={{ mode, toggle }}>{children}</Ctx.Provider>;
}

/**
 * useLang — call inside any component wrapped by <LangProvider>.
 *
 * Returns:
 *   plain  — true when plain-English mode is active
 *   toggle — flip between modes
 *   t(pro, plain) — returns the appropriate string for the active mode
 */
export function useLang() {
  const { mode, toggle } = useContext(Ctx);
  return {
    plain: mode === "plain",
    toggle,
    t: (pro: string, plain: string) => (mode === "plain" ? plain : pro),
  };
}
