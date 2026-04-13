export default function KDSLoading() {
  return (
    <div className="pos-screen flex h-screen flex-col bg-surface text-text">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-surface-raised rounded-lg animate-pulse" />
          <div className="h-5 w-36 bg-surface-raised rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-surface-raised rounded-lg animate-pulse" />
        </div>
        <div className="h-4 w-28 bg-surface-raised rounded animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-raised">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 bg-surface-hover rounded animate-pulse" />
                  <div className="h-4 w-12 bg-surface-hover rounded animate-pulse" />
                </div>
                <div className="h-5 w-10 bg-surface-hover rounded-full animate-pulse" />
              </div>
              <div className="divide-y divide-border/50 px-4">
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between py-3">
                    <div>
                      <div className="h-4 w-28 bg-surface-hover rounded animate-pulse" />
                      <div className="h-3 w-20 bg-surface rounded animate-pulse mt-1" />
                    </div>
                    <div className="h-7 w-16 bg-surface-hover rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3">
                <div className="h-9 w-full bg-surface-hover rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
