"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  // On mount read saved preference
  useEffect(() => {
    const saved = localStorage.getItem("sna-theme");
    const prefersDark = saved ? saved === "dark" : true; // default dark
    setIsDark(prefersDark);
    document.documentElement.classList.toggle("light", !prefersDark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("sna-theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center border border-[var(--border)] p-1.5 transition-all hover:border-[var(--red)] hover:bg-[var(--red-dim)]"
      style={{ width: 32, height: 32 }}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-[var(--text-dim)] hover:text-[var(--red)]" strokeWidth={1.5} />
      ) : (
        <Moon className="h-3.5 w-3.5 text-[var(--text-dim)] hover:text-[var(--red)]" strokeWidth={1.5} />
      )}
    </button>
  );
}
