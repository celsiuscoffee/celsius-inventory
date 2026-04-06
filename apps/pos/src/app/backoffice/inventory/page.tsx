"use client";

import { useState } from "react";
import { SAMPLE_PRODUCTS } from "@/lib/sample-data";
import { displayRM } from "@/types/database";

type InventoryTab = "stock" | "stock-take" | "wastage" | "transfers";

const SAMPLE_STOCK = SAMPLE_PRODUCTS.map((p, i) => ({
  ...p,
  currentStock: Math.floor(Math.random() * 100) + 5,
  minStock: 10,
  status: Math.random() > 0.3 ? "ok" : "low",
}));

const SAMPLE_WASTAGE = [
  { id: "1", date: "2026-04-04", product: "Oat Milk", qty: "500ml", reason: "Expired", staff: "Sarah", cost: 350 },
  { id: "2", date: "2026-04-04", product: "Banana Bread", qty: "2 pcs", reason: "Damaged", staff: "Ali", cost: 800 },
  { id: "3", date: "2026-04-03", product: "Coffee Beans", qty: "200g", reason: "Spillage", staff: "Ammar", cost: 600 },
];

const SAMPLE_TRANSFERS = [
  { id: "1", date: "2026-04-03", from: "Shah Alam", to: "IOI Conezion", items: 5, status: "completed" },
  { id: "2", date: "2026-04-04", from: "Shah Alam", to: "Tamarind", items: 3, status: "pending" },
];

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>("stock");
  const [showStockTake, setShowStockTake] = useState(false);
  const [showWastage, setShowWastage] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Inventory</h1><p className="mt-1 text-sm text-text-muted">Stock levels, counts, wastage, and transfers</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowWastage(true)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">Record Wastage</button>
          <button onClick={() => setShowTransfer(true)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">Stock Transfer</button>
          <button onClick={() => setShowStockTake(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Start Stock Take</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface-raised p-4"><p className="text-xs text-text-muted">Total Products</p><p className="text-xl font-bold">{SAMPLE_STOCK.length}</p></div>
        <div className="rounded-xl border border-border bg-surface-raised p-4"><p className="text-xs text-text-muted">Low Stock</p><p className="text-xl font-bold text-warning">{SAMPLE_STOCK.filter((s) => s.status === "low").length}</p></div>
        <div className="rounded-xl border border-border bg-surface-raised p-4"><p className="text-xs text-text-muted">Wastage (This Week)</p><p className="text-xl font-bold text-danger">{displayRM(SAMPLE_WASTAGE.reduce((s, w) => s + w.cost, 0))}</p></div>
        <div className="rounded-xl border border-border bg-surface-raised p-4"><p className="text-xs text-text-muted">Pending Transfers</p><p className="text-xl font-bold">{SAMPLE_TRANSFERS.filter((t) => t.status === "pending").length}</p></div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {([["stock", "Stock Levels"], ["stock-take", "Stock Takes"], ["wastage", "Wastage"], ["transfers", "Transfers"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === id ? "border-brand text-brand" : "border-transparent text-text-muted hover:text-text"}`}>{label}</button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "stock" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Current Stock</th><th className="px-4 py-3 text-right">Min Level</th><th className="px-4 py-3 text-center">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_STOCK.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-text-muted">{item.sku}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{item.currentStock}</td>
                    <td className="px-4 py-3 text-right text-sm text-text-muted">{item.minStock}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "ok" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                        {item.status === "ok" ? "OK" : "LOW"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "wastage" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3 text-right">Cost</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_WASTAGE.map((w) => (
                  <tr key={w.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-sm">{w.date}</td>
                    <td className="px-4 py-3 text-sm font-medium">{w.product}</td>
                    <td className="px-4 py-3 text-sm">{w.qty}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-medium text-danger">{w.reason}</span></td>
                    <td className="px-4 py-3 text-sm text-text-muted">{w.staff}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-danger">{displayRM(w.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "stock-take" && (
          <div className="rounded-xl border border-border bg-surface-raised p-8 text-center">
            <span className="text-4xl">📋</span>
            <p className="mt-3 text-sm font-medium">No stock takes this period</p>
            <p className="mt-1 text-xs text-text-dim">Start a stock take to count and reconcile inventory</p>
            <button onClick={() => setShowStockTake(true)} className="mt-4 rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Start Stock Take</button>
          </div>
        )}

        {tab === "transfers" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-center">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_TRANSFERS.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3 text-sm">{t.date}</td>
                    <td className="px-4 py-3 text-sm font-medium">{t.from}</td>
                    <td className="px-4 py-3 text-sm font-medium">{t.to}</td>
                    <td className="px-4 py-3 text-right text-sm">{t.items}</td>
                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.status === "completed" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wastage modal */}
      {showWastage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Record Wastage</h3>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-xs text-text-muted">Product *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option value="">Select product</option>{SAMPLE_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-text-muted">Quantity *</label><input type="number" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder="e.g. 2" /></div>
                <div><label className="mb-1 block text-xs text-text-muted">Unit</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option>pcs</option><option>ml</option><option>g</option></select></div>
              </div>
              <div><label className="mb-1 block text-xs text-text-muted">Reason *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option value="">Select reason</option><option>Expired</option><option>Damaged</option><option>Spillage</option><option>Breakage</option><option>Theft</option><option>Other</option></select></div>
              <div><label className="mb-1 block text-xs text-text-muted">Notes</label><textarea rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand" /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowWastage(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowWastage(false)} className="flex-1 rounded-lg bg-danger py-2 text-sm font-semibold text-white hover:bg-danger/80">Record Wastage</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Take modal */}
      {showStockTake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Stock Take</h3>
            <p className="mt-1 text-sm text-text-muted">Count each product and enter the actual quantity.</p>
            <div className="mt-4 max-h-[50vh] overflow-y-auto space-y-2">
              {SAMPLE_PRODUCTS.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div><p className="text-sm font-medium">{p.name}</p><p className="text-[10px] text-text-dim">{p.sku}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-dim">Expected: {Math.floor(Math.random() * 50) + 5}</span>
                    <input type="number" className="h-8 w-20 rounded border border-border bg-surface px-2 text-right text-sm text-text outline-none focus:border-brand" placeholder="Count" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowStockTake(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowStockTake(false)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Submit Count</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Stock Transfer</h3>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-text-muted">From Branch *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option>Shah Alam</option><option>IOI Conezion</option><option>Tamarind</option></select></div>
                <div><label className="mb-1 block text-xs text-text-muted">To Branch *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option>IOI Conezion</option><option>Shah Alam</option><option>Tamarind</option></select></div>
              </div>
              <div><label className="mb-1 block text-xs text-text-muted">Products</label>
                <p className="text-[10px] text-text-dim mb-2">Add items to transfer</p>
                <button className="w-full rounded-lg border border-dashed border-border py-3 text-xs text-text-muted hover:border-brand hover:bg-brand/5">+ Add Product</button>
              </div>
              <div><label className="mb-1 block text-xs text-text-muted">Notes</label><textarea rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand" /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowTransfer(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowTransfer(false)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Create Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
