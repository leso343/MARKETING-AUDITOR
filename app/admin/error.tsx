"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-20 px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
          <AlertTriangle className="h-6 w-6 text-[var(--red)]" />
        </div>

        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Admin panel error
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Something went wrong loading this admin page. Try refreshing or
            return to the dashboard.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[9px] text-[var(--text-dim)] uppercase tracking-wider">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded border border-[var(--border)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--text-dim)] transition-all hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            <RotateCcw className="h-3 w-3" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded bg-[var(--red)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-90"
          >
            <Home className="h-3 w-3" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
