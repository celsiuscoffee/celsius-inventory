"use client";

import { useState } from "react";

const SAMPLE_SUPPLIERS = [
  { id: "1", name: "Coffee Bean Co.", code: "SUP001", phone: "+60123456789", email: "orders@coffeebean.co", location: "KL", leadDays: 2, products: 5, status: "active" },
  { id: "2", name: "Fresh Dairy Sdn Bhd", code: "SUP002", phone: "+60198765432", email: "supply@freshdairy.my", location: "Shah Alam", leadDays: 1, products: 3, status: "active" },
  { id: "3", name: "Packaging World", code: "SUP003", phone: "+60111222333", email: "sales@packworld.com", location: "Petaling Jaya", leadDays: 3, products: 8, status: "active" },
  { id: "4", name: "Syrup Masters", code: "SUP004", phone: "+60144555666", email: "info@syrupmasters.com", location: "Kuala Lumpur", leadDays: 5, products: 4, status: "inactive" },
];

export default function SuppliersPage() {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Suppliers</h1><p className="mt-1 text-sm text-text-muted">{SAMPLE_SUPPLIERS.length} suppliers</p></div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">+ Add Supplier</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {SAMPLE_SUPPLIERS.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-border-light">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{s.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.status === "active" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>{s.status}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-mono text-text-dim">{s.code}</p>
              </div>
              <button className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-hover">Edit</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-text-dim">Phone:</span> <span className="text-text-muted">{s.phone}</span></div>
              <div><span className="text-text-dim">Location:</span> <span className="text-text-muted">{s.location}</span></div>
              <div><span className="text-text-dim">Lead Time:</span> <span className="text-text-muted">{s.leadDays} days</span></div>
              <div><span className="text-text-dim">Products:</span> <span className="text-text-muted">{s.products} items</span></div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Add Supplier</h3>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-xs text-text-muted">Supplier Name *</label><input type="text" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-text-muted">Phone</label><input type="tel" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
                <div><label className="mb-1 block text-xs text-text-muted">Email</label><input type="email" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs text-text-muted">Location</label><input type="text" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
                <div><label className="mb-1 block text-xs text-text-muted">Lead Time (days)</label><input type="number" defaultValue={1} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Add Supplier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
