export default function KDSLoading() {
  return (
    <div className="min-h-dvh bg-[#f0f0f0] flex flex-col select-none">
      {/* Header skeleton */}
      <header className="bg-[#160800] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="h-5 w-32 bg-white/20 rounded animate-pulse" />
          <div className="h-3 w-20 bg-white/10 rounded mt-1 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-20 bg-white/10 rounded-full animate-pulse" />
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
        </div>
      </header>

      {/* Tabs skeleton */}
      <div className="bg-white border-b shrink-0">
        <div className="flex">
          <div className="flex-1 py-2.5 flex justify-center">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 py-2.5 flex justify-center">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Card skeletons */}
      <div className="flex-1 p-3 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border-2 border-transparent overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="px-4 pb-3 space-y-2 border-b border-border/40">
              <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-28 bg-gray-50 rounded animate-pulse" />
            </div>
            <div className="px-3 py-3 flex gap-2">
              <div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" />
              <div className="w-12 h-12 bg-gray-50 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav skeleton */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-border/50 flex items-center z-20">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-3 gap-1">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-2.5 w-10 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </nav>
    </div>
  );
}
