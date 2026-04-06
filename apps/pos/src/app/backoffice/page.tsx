"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { displayRM } from "@/types/database";

export default function BackofficeDashboard() {
  const [stats, setStats] = useState({ sales: 0, orders: 0, avgOrder: 0, activeProducts: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];

      const { data: orders } = await supabase
        .from("pos_orders")
        .select("total, status, order_number, order_type, created_at")
        .gte("created_at", today)
        .order("created_at", { ascending: false });

      const completed = (orders ?? []).filter((o: any) => o.status === "completed");
      const totalSales = completed.reduce((s: number, o: any) => s + (o.total ?? 0), 0);

      const { count: productCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_available", true);

      setStats({
        sales: totalSales,
        orders: completed.length,
        avgOrder: completed.length > 0 ? Math.round(totalSales / completed.length) : 0,
        activeProducts: productCount ?? 0,
      });

      setRecentOrders((orders ?? []).slice(0, 10));
    }
    load();
  }, [supabase]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-text-muted">Today's performance</p>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-xs text-text-muted">Today's Sales</p>
          <p className="mt-1 text-2xl font-bold">{displayRM(stats.sales)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-xs text-text-muted">Orders</p>
          <p className="mt-1 text-2xl font-bold">{stats.orders}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-xs text-text-muted">Avg Order</p>
          <p className="mt-1 text-2xl font-bold">{stats.orders > 0 ? displayRM(stats.avgOrder) : "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-xs text-text-muted">Products Active</p>
          <p className="mt-1 text-2xl font-bold">{stats.activeProducts}</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface-raised">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent Orders</h2>
        </div>
        {recentOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-dim">No orders today</p>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((o: any) => (
              <div key={o.order_number} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium">{o.order_number}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    o.status === "completed" ? "bg-success/20 text-success" : o.status === "cancelled" ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"
                  }`}>{o.status}</span>
                </div>
                <span className="text-sm font-medium">{displayRM(o.total ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
