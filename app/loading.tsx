export default function HomeLoading() {
  return (
    <div className="min-h-screen p-6 sm:p-12 lg:p-16 animate-pulse">
      {/* Logo skeleton */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 bg-[var(--border)] rounded" />
        <div>
          <div className="h-5 w-32 bg-[var(--border)] rounded mb-1" />
          <div className="h-3 w-16 bg-[var(--border)] rounded" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="h-3 w-52 bg-[var(--border)] rounded mb-3" />
      <div className="h-7 w-48 bg-[var(--border)] rounded mb-6" />

      {/* Client cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-[var(--border)] rounded" />
              <div>
                <div className="h-4 w-28 bg-[var(--border)] rounded mb-1" />
                <div className="h-3 w-20 bg-[var(--border)] rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-[var(--border)] rounded mb-2" />
            <div className="h-3 w-3/4 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
