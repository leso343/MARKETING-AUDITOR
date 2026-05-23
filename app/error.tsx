"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]">
          <AlertTriangle className="h-7 w-7 text-[var(--red)]" />
        </div>

        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            An unexpected error occurred. Try refreshing or go back to the home
            page.
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
            <ArrowLeft className="h-3 w-3" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
