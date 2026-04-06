"use client";

import { useState, useEffect } from "react";
import { displayRM } from "@/types/database";
import { createClient } from "@/lib/supabase-browser";

type ReportTab = "sales" | "transactions" | "products" | "staff";

const productData = [
  { name: "Iced Latte", qty: 85, revenue: 119000, pct: 22 },
  { name: "Hot Latte", qty: 62, revenue: 80600, pct: 15 },
  { name: "Americano", qty: 48, revenue: 52800, pct: 10 },
  { name: "Matcha Latte", qty: 41, revenue: 61500, pct: 11 },
  { name: "Cappuccino", qty: 38, revenue: 53200, pct: 10 },
  { name: "Chicken Sandwich", qty: 32, revenue: 57600, pct: 11 },
  { name: "Mocha", qty: 28, revenue: 44800, pct: 8 },
  { name: "Egg Croissant", qty: 25, revenue: 37500, pct: 7 },
];

const SAMPLE_STAFF_PERF = [
  { name: "Ammar", orders: 120, revenue: 614000, avgOrder: 5117 },
  { name: "Sarah", orders: 95, revenue: 489500, avgOrder: 5153 },
  { name: "Ali", orders: 78, revenue: 398200, avgOrder: 5105 },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [salesData, setSalesData] = useState<{ date: string; orders: number; revenue: number; avgOrder: number }[]>([]);
  const [productData, setProductData] = useState<{ name: string; qty: number; revenue: number; pct: number }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Fetch real orders grouped by date
      const { data: orders } = await supabase
        .from("pos_orders")
        .select("total, status, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      // Group by date
      const byDate: Record<string, { orders: number; revenue: number }> = {};
      for (const o of orders ?? []) {
        const date = (o.created_at as string).split("T")[0];
        if (!byDate[date]) byDate[date] = { orders: 0, revenue: 0 };
        byDate[date].orders++;
        byDate[date].revenue += o.total ?? 0;
      }
      const sales = Object.entries(byDate).map(([date, d]) => ({
        date, orders: d.orders, revenue: d.revenue,
        avgOrder: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      setSalesData(sales);

      // Fetch product mix from order items
      const { data: items } = await supabase.from("pos_order_items").select("product_name, quantity, item_total");
      const byProduct: Record<string, { qty: number; revenue: number }> = {};
      for (const i of items ?? []) {
        const name = i.product_name;
        if (!byProduct[name]) byProduct[name] = { qty: 0, revenue: 0 };
        byProduct[name].qty += i.quantity ?? 0;
        byProduct[name].revenue += i.item_total ?? 0;
      }
      const totalRev = Object.values(byProduct).reduce((s, p) => s + p.revenue, 0) || 1;
      const products = Object.entries(byProduct)
        .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue, pct: Math.round((d.revenue / totalRev) * 100) }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      setProductData(products);
    }
    load();
  }, [supabase]);

  const SAMPLE_SALES = salesData;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="mt-1 text-sm text-text-muted">Business analytics and insights</p></div>
        <div className="flex gap-2">
          <select className="h-9 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text outline-none focus:border-brand">
            <option>All Branches</option><option>Shah Alam</option><option>IOI Conezion</option><option>Tamarind</option>
          </select>
          <select className="h-9 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text outline-none focus:border-brand">
            <option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option><option>Custom</option>
          </select>
          <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">Export CSV</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: displayRM(SAMPLE_SALES.reduce((s, d) => s + d.revenue, 0)), change: "+8.2%", color: "text-success" },
          { label: "Total Orders", value: String(SAMPLE_SALES.reduce((s, d) => s + d.orders, 0)), change: "+5.1%", color: "text-success" },
          { label: "Avg Order Value", value: displayRM(5130), change: "+2.3%", color: "text-success" },
          { label: "Top Product", value: "Iced Latte", change: "85 sold", color: "text-brand" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface-raised p-4">
            <p className="text-xs text-text-muted">{stat.label}</p>
            <p className="mt-1 text-xl font-bold">{stat.value}</p>
            <p className={`mt-0.5 text-[10px] ${stat.color}`}>{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {([["sales", "Sales Summary"], ["transactions", "Transactions"], ["products", "Product Mix"], ["staff", "Staff Performance"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === id ? "border-brand text-brand" : "border-transparent text-text-muted hover:text-text"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {tab === "sales" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Avg Order</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_SALES.map((d) => (
                  <tr key={d.date} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-sm font-medium">{d.date}</td>
                    <td className="px-4 py-3 text-right text-sm">{d.orders}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{displayRM(d.revenue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-text-muted">{displayRM(d.avgOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "transactions" && (
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <p className="text-sm text-text-muted">Transaction history is available in the POS Register &rarr; Transactions panel</p>
            <a href="/register" className="mt-2 inline-block text-sm text-brand hover:underline">Go to POS Register</a>
          </div>
        )}

        {tab === "products" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">#</th><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">% of Sales</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {productData.map((p, i) => (
                  <tr key={p.name} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-xs text-text-dim">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right text-sm">{p.qty}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{displayRM(p.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-surface">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className="text-xs text-text-muted">{p.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "staff" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">Staff</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Avg Order</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_STAFF_PERF.map((s) => (
                  <tr key={s.name} className="hover:bg-surface-hover">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">{s.name.charAt(0)}</div><span className="text-sm font-medium">{s.name}</span></div></td>
                    <td className="px-4 py-3 text-right text-sm">{s.orders}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{displayRM(s.revenue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-text-muted">{displayRM(s.avgOrder)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
