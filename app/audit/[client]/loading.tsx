export default function AuditLoading() {
  return (
    <div className="min-h-screen p-6 sm:p-12 lg:p-16 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="h-3 w-48 bg-[var(--border)] rounded mb-4" />

      {/* Title skeleton */}
      <div className="h-8 w-72 bg-[var(--border)] rounded mb-2" />
      <div className="h-4 w-56 bg-[var(--border)] rounded mb-8" />

      {/* Score cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel">
            <div className="h-3 w-20 bg-[var(--border)] rounded mb-3" />
            <div className="h-8 w-24 bg-[var(--border)] rounded mb-1" />
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="panel h-64">
          <div className="h-4 w-32 bg-[var(--border)] rounded mb-4" />
          <div className="h-full bg-[var(--border)] rounded opacity-30" />
        </div>
        <div className="panel h-64">
          <div className="h-4 w-32 bg-[var(--border)] rounded mb-4" />
          <div className="h-full bg-[var(--border)] rounded opacity-30" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="panel">
        <div className="h-4 w-40 bg-[var(--border)] rounded mb-6" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-[var(--border)] last:border-0">
            <div className="h-4 w-1/4 bg-[var(--border)] rounded" />
            <div className="h-4 w-1/6 bg-[var(--border)] rounded" />
            <div className="h-4 w-1/6 bg-[var(--border)] rounded" />
            <div className="h-4 w-1/6 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
