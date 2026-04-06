"use client";

import { useState } from "react";
import { displayRM } from "@/types/database";

const SAMPLE_POS = [
  { id: "1", number: "PO-CC-SA-001", supplier: "Coffee Bean Co.", branch: "Shah Alam", date: "2026-04-03", items: 3, total: 125000, status: "completed", deliveryDate: "2026-04-05" },
  { id: "2", number: "PO-CC-SA-002", supplier: "Fresh Dairy Sdn Bhd", branch: "Shah Alam", date: "2026-04-04", items: 2, total: 48000, status: "sent", deliveryDate: "2026-04-05" },
  { id: "3", number: "PO-CC-IOI-001", supplier: "Packaging World", branch: "IOI Conezion", date: "2026-04-04", items: 5, total: 32000, status: "draft", deliveryDate: null },
  { id: "4", number: "PO-CC-SA-003", supplier: "Syrup Masters", branch: "Shah Alam", date: "2026-04-01", items: 4, total: 89000, status: "partially_received", deliveryDate: "2026-04-03" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface text-text-muted",
  pending: "bg-warning/20 text-warning",
  sent: "bg-blue-500/20 text-blue-400",
  partially_received: "bg-orange-500/20 text-orange-400",
  completed: "bg-success/20 text-success",
  cancelled: "bg-danger/20 text-danger",
};

export default function PurchaseOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Purchase Orders</h1><p className="mt-1 text-sm text-text-muted">{SAMPLE_POS.length} orders</p></div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">+ New Purchase Order</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
            <th className="px-4 py-3">PO Number</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {SAMPLE_POS.map((po) => (
              <tr key={po.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3 text-sm font-mono font-medium">{po.number}</td>
                <td className="px-4 py-3 text-sm">{po.supplier}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{po.branch}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{po.date}</td>
                <td className="px-4 py-3 text-right text-sm">{po.items}</td>
                <td className="px-4 py-3 text-right text-sm font-medium">{displayRM(po.total)}</td>
                <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS[po.status] ?? ""}`}>{po.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-right"><button className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-hover">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">New Purchase Order</h3>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-text-muted">Supplier *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option value="">Select supplier</option><option>Coffee Bean Co.</option><option>Fresh Dairy Sdn Bhd</option><option>Packaging World</option></select></div>
                <div><label className="mb-1 block text-xs text-text-muted">Branch *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option>Shah Alam</option><option>IOI Conezion</option><option>Tamarind</option></select></div>
              </div>
              <div><label className="mb-1 block text-xs text-text-muted">Expected Delivery Date</label><input type="date" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Items</label>
                <button className="w-full rounded-lg border border-dashed border-border py-3 text-xs text-text-muted hover:border-brand hover:bg-brand/5">+ Add Item</button>
              </div>
              <div><label className="mb-1 block text-xs text-text-muted">Notes</label><textarea rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand" /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">Save Draft</button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
