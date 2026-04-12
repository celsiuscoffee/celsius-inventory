"use client";

export default function PurchaseOrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
      <p className="mt-1 text-sm text-text-muted">Manage supplier orders and deliveries</p>
      <div className="mt-12 flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised text-3xl">📋</div>
        <h2 className="mt-4 text-lg font-semibold">Coming Soon</h2>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          Purchase order management with supplier tracking, delivery scheduling, and receiving will be available here.
        </p>
      </div>
    </div>
  );
}
