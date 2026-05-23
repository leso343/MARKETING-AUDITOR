export default function BillingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-3 w-28 bg-[var(--border)] rounded mb-3" />
        <div className="h-7 w-24 bg-[var(--border)] rounded mb-1" />
        <div className="h-4 w-48 bg-[var(--border)] rounded" />
      </div>

      {/* Plan card */}
      <div className="panel overflow-hidden">
        <div className="h-1 w-full bg-[var(--border)] rounded mb-4" />
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-[var(--border)] rounded-xl" />
          <div>
            <div className="h-6 w-24 bg-[var(--border)] rounded mb-2" />
            <div className="h-4 w-16 bg-[var(--border)] rounded" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel">
            <div className="h-3 w-16 bg-[var(--border)] rounded mb-3" />
            <div className="h-6 w-20 bg-[var(--border)] rounded mb-1" />
            <div className="h-3 w-24 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
