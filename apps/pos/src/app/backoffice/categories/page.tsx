"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const supabase = createClient();

export default function CategoriesPage() {
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("products").select("category").not("category", "is", null);
      if (data) {
        const counts: Record<string, number> = {};
        for (const p of data) {
          const cat = p.category as string;
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
        setCategories(
          Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, count]) => ({ name, count }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="mt-1 text-sm text-text-muted">{categories.length} categories from products</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-text-dim">Categories are derived from the product catalog. Edit product categories in the Products page.</p>

      {loading ? (
        <div className="mt-8 text-center text-sm text-text-muted">Loading...</div>
      ) : (
        <div className="mt-4 space-y-2">
          {categories.map((cat, i) => (
            <div key={cat.name} className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-xs text-text-dim">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium capitalize">{cat.name.replace(/-/g, " ")}</p>
                  <p className="text-[10px] text-text-dim font-mono">{cat.name}</p>
                </div>
              </div>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-muted">{cat.count} products</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
