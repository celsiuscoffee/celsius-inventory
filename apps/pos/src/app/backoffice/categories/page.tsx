"use client";

import { useState } from "react";
import { SAMPLE_CATEGORIES } from "@/lib/sample-data";

export default function CategoriesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const categories = SAMPLE_CATEGORIES.filter((c) => c.slug !== "all");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Categories</h1><p className="mt-1 text-sm text-text-muted">{categories.length} categories</p></div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">+ Add Category</button>
      </div>
      <p className="mt-2 text-xs text-text-dim">Drag to reorder. Categories determine the tab order on the POS register.</p>
      <div className="mt-4 space-y-2">
        {categories.map((cat, i) => (
          <div key={cat.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-text-dim">{i + 1}</span>
              <div><p className="text-sm font-medium">{cat.name}</p><p className="text-[10px] text-text-dim font-mono">{cat.slug}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${cat.is_active ? "bg-success" : "bg-danger"}`} />
              <button className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-hover">Edit</button>
            </div>
          </div>
        ))}
      </div>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Add Category</h3>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-xs text-text-muted">Name *</label><input type="text" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder="e.g. Smoothies" /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Slug *</label><input type="text" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text font-mono outline-none focus:border-brand" placeholder="e.g. smoothies" /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
