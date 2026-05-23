import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--red)]">
        Error 404
      </div>
      <h1
        className="mt-3 text-3xl font-bold tracking-tight"
        style={{ fontFamily: "var(--font-head)" }}
      >
        No CSVs found for this client.
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--text-dim)]">
        Drop Meta Ads exports into{" "}
        <span className="font-mono text-[var(--text)]">
          /public/csvs/&lt;client-slug&gt;/
        </span>{" "}
        and reload.
      </p>
      <Link
        href="/"
        className="mt-6 border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
      >
        ← All clients
      </Link>
    </main>
  );
}
