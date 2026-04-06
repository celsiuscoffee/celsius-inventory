"use client";

import { useState, useRef, useEffect } from "react";
import { displayRM } from "@/types/database";
import { exportProductsCSV, downloadCSV, parseCSV, validateImport } from "@/lib/csv-utils";
import { adaptProducts } from "@/lib/product-adapter";
import { createClient } from "@/lib/supabase-browser";
import type { Product } from "@/types/database";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("products").select("*").order("name");
      const products = adaptProducts((data ?? []) as Record<string, unknown>[]);
      setAllProducts(products);
      const cats = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
      setCategories(cats.sort());
      setLoading(false);
    }
    load();
  }, [supabase]);
  const [showImportResult, setShowImportResult] = useState<{ count: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const csv = exportProductsCSV(allProducts);
    downloadCSV(csv, `celsius-products-${new Date().toISOString().split("T")[0]}.csv`);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const { rows } = parseCSV(text);
      const result = validateImport(rows);
      if (result.valid && result.products.length > 0) {
        // Upsert to Supabase
        for (const p of result.products) {
          if (!p.name) continue;
          const existing = allProducts.find((ap) => ap.sku === p.sku && p.sku);
          if (existing) {
            await supabase.from("products").update({
              name: p.name, price: (p.price ?? 0) / 100, cost: p.cost ? (p.cost) / 100 : null,
              category: p.category, kitchen_station: p.kitchen_station,
              is_available: p.is_available, description: p.description,
            }).eq("id", existing.id);
          }
        }
        // Reload
        const { data } = await supabase.from("products").select("*").order("name");
        setAllProducts(adaptProducts((data ?? []) as Record<string, unknown>[]));
      }
      setShowImportResult({ count: result.products.length, errors: result.errors.length });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const filtered = allProducts.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-text-muted">
            {allProducts.length} products
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">
            Export CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">
            Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full max-w-md rounded-lg border border-border bg-surface-raised pl-10 pr-4 text-sm text-text outline-none placeholder:text-text-dim focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <svg
            className="absolute left-3 top-3 h-4 w-4 text-text-dim"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text outline-none focus:border-brand"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Product Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-center">Station</th>
              <th className="px-4 py-3 text-center">Available</th>
              <th className="px-4 py-3 text-center">Modifiers</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((product) => (
              <tr
                key={product.id}
                className="transition-colors hover:bg-surface-hover"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-alt text-lg">
                      {product.category === "coffee" ||
                      product.category === "non-coffee"
                        ? "☕"
                        : product.category === "tea"
                        ? "🍵"
                        : product.category === "food"
                        ? "🥪"
                        : "🥐"}
                    </div>
                    <span className="text-sm font-medium">{product.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono">
                  {product.sku}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium capitalize text-text-muted">
                    {product.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {displayRM(product.price)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-text-muted">
                  {product.cost ? displayRM(product.cost) : "—"}
                </td>
                <td className="px-4 py-3 text-center text-xs text-text-muted">
                  {product.kitchen_station}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      product.is_available ? "bg-success" : "bg-danger"
                    }`}
                  />
                </td>
                <td className="px-4 py-3 text-center text-xs text-text-dim">
                  {product.modifiers.length > 0
                    ? `${product.modifiers.length} group${
                        product.modifiers.length > 1 ? "s" : ""
                      }`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-text"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <ProductModal
          categories={categories}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={async () => {
            // Reload products after save
            const { data } = await supabase.from("products").select("*").order("name");
            setAllProducts(adaptProducts((data ?? []) as Record<string, unknown>[]));
            setEditingProduct(null);
          }}
        />
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <ProductModal
          categories={categories}
          product={null}
          onClose={() => setShowAddModal(false)}
          onSave={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
  onSave,
}: {
  categories: string[];
  product: Product | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEditing = product !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-2xl rounded-2xl bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">
            {isEditing ? `Edit: ${product.name}` : "Add New Product"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Product Name *
              </label>
              <input
                type="text"
                defaultValue={product?.name ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                SKU
              </label>
              <input
                type="text"
                defaultValue={product?.sku ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Category *
              </label>
              <select
                defaultValue={product?.category ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              >
                <option value="">Select category</option>
                {categories.map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Price (RM) *
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue={product ? (product.price / 100).toFixed(2) : ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Cost Price (RM)
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue={
                  product?.cost ? (product.cost / 100).toFixed(2) : ""
                }
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Kitchen Station
              </label>
              <select
                defaultValue={product?.kitchen_station ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              >
                <option value="">None</option>
                <option value="Bar">Bar</option>
                <option value="Kitchen">Kitchen</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Tax Code
              </label>
              <select
                defaultValue={product?.tax_code ?? ""}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"
              >
                <option value="">No Tax</option>
                <option value="SST6">SST 6%</option>
                <option value="SST8">SST 8%</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Description
              </label>
              <textarea
                defaultValue={product?.description ?? ""}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={product?.is_available ?? true}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                Available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={product?.track_stock ?? false}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                Track Stock
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={product?.is_featured ?? false}
                  className="h-4 w-4 rounded border-border accent-brand"
                />
                Featured
              </label>
            </div>
          </div>

          {/* Modifiers section */}
          {isEditing && product.modifiers.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold">Modifiers</h4>
              <div className="mt-2 space-y-2">
                {product.modifiers.map((group) => (
                  <div
                    key={group.group_name}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {group.group_name}
                      </span>
                      {group.is_required && (
                        <span className="text-xs text-brand">Required</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {group.options.map((opt) => (
                        <span
                          key={opt.name}
                          className="rounded bg-surface-alt px-2 py-0.5 text-xs text-text-muted"
                        >
                          {opt.name}
                          {opt.price > 0 && ` (+${displayRM(opt.price)})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {isEditing ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
