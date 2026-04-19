export default function HrLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-6 w-24 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
        </div>

        {/* Clock in card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="h-12 w-full rounded-lg bg-gray-200 animate-pulse" />
        </div>

        {/* Row of module tiles */}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 space-y-2"
            >
              <div className="h-9 w-9 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
