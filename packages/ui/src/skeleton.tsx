import * as React from "react";
import { cn } from "./utils";

// Generic shimmer block used as a placeholder while a route's data is
// loading. We rely on Tailwind's `animate-pulse` rather than a custom
// keyframe so the shape matches the rest of the muted palette.
function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/70", className)}
      {...props}
    />
  );
}

// Page-level skeleton tuned for the backoffice's standard data-table screen
// (header row, filter row, table). Used by route-level loading.tsx files so
// the user sees the right *shape* while data loads instead of a blank page
// or a centred spinner. Mirrors the layout of the most common admin pages
// (inventory/products, settings/staff, finance/bank-statements, etc.).
function TableLoadingSkeleton({
  rows = 8,
  showFilters = true,
  className,
}: {
  rows?: number;
  showFilters?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("p-3 sm:p-6 space-y-4", className)}>
      {/* Header: title + primary action */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}

      {/* Table-style rows */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-2.5">
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Card-grid skeleton for dashboards — KPI tiles + a wider chart placeholder.
function DashboardLoadingSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export { Skeleton, TableLoadingSkeleton, DashboardLoadingSkeleton };
