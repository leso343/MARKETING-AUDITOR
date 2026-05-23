export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Breadcrumb */}
      <div>
        <div className="h-3 w-32 bg-[var(--border)] rounded mb-3" />
        <div className="h-7 w-40 bg-[var(--border)] rounded mb-1" />
        <div className="h-4 w-56 bg-[var(--border)] rounded" />
      </div>

      {/* Content cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-[var(--border)] rounded" />
              <div>
                <div className="h-4 w-32 bg-[var(--border)] rounded mb-1" />
                <div className="h-3 w-24 bg-[var(--border)] rounded" />
              </div>
            </div>
            <div className="h-6 w-16 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
