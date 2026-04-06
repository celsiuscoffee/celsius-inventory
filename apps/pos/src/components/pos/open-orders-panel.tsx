"use client";

import { useEffect } from "react";
import { usePOS, type DBOrder } from "@/lib/pos-context";
import { displayRM } from "@/types/database";
import { format } from "date-fns";

type Props = {
  onLoadOrder: (order: DBOrder) => void;
};

export function OpenOrdersPanel({ onLoadOrder }: Props) {
  const { openOrders, loadOrders } = usePOS();

  // Refresh orders every 10 seconds
  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Open Orders</h2>
        <p className="text-xs text-text-muted">{openOrders.length} active</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {openOrders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <span className="text-3xl">📋</span>
            <p className="mt-2 text-sm">No open orders</p>
            <p className="text-xs text-text-dim">Dine-in orders appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {openOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => onLoadOrder(order)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      order.order_type === "dine_in" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                    }`}>
                      {order.order_type === "dine_in" ? `TABLE ${order.table_number}` : order.queue_number}
                    </span>
                    <span className="text-xs text-text-dim">{order.order_number}</span>
                  </div>
                  <span className="text-sm font-semibold">{displayRM(order.subtotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    {order.pos_order_items?.length ?? 0} items
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    order.status === "sent_to_kitchen" ? "bg-kds-green/20 text-kds-green" : "bg-warning/20 text-warning"
                  }`}>
                    {order.status === "sent_to_kitchen" ? "In Kitchen" : "Open"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-text-dim">{format(new Date(order.created_at), "h:mm a")}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
