"use client";

import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronDown, Coffee, Upload, Search } from "lucide-react";

const MENUS = [
  { id: "1", name: "Iced Latte", category: "Coffee", sellingPrice: 12.00, cogs: 3.85, cogsPercent: 32.1, ingredients: [
    { product: "Fresh Milk", sku: "DFM001", qty: 200, uom: "ml", cost: 1.00 },
    { product: "Espresso Shot", sku: "CB001", qty: 30, uom: "ml", cost: 1.50 },
    { product: "Plastic Cup", sku: "PC003", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Iced Strawless Lid", sku: "PL002", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Straw Milkshake", sku: "PS0002", qty: 1, uom: "pcs", cost: 0.02 },
    { product: "Ice", sku: "ICE01", qty: 150, uom: "g", cost: 0.25 },
  ]},
  { id: "2", name: "Hot Americano", category: "Coffee", sellingPrice: 9.00, cogs: 2.10, cogsPercent: 23.3, ingredients: [
    { product: "Espresso Shot", sku: "CB001", qty: 30, uom: "ml", cost: 1.50 },
    { product: "Hot Lid (9oz)", sku: "PL001", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Paper Cup 9oz", sku: "PC001", qty: 1, uom: "pcs", cost: 0.06 },
    { product: "Sugar Packet", sku: "S0001", qty: 2, uom: "pcs", cost: 0.10 },
  ]},
  { id: "3", name: "Caramel Latte", category: "Coffee", sellingPrice: 14.00, cogs: 5.20, cogsPercent: 37.1, ingredients: [
    { product: "Fresh Milk", sku: "DFM001", qty: 200, uom: "ml", cost: 1.00 },
    { product: "Espresso Shot", sku: "CB001", qty: 30, uom: "ml", cost: 1.50 },
    { product: "Monin Caramel Syrup", sku: "FM001", qty: 20, uom: "ml", cost: 1.04 },
    { product: "Plastic Cup", sku: "PC003", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Iced Strawless Lid", sku: "PL002", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Ice", sku: "ICE01", qty: 150, uom: "g", cost: 0.25 },
  ]},
  { id: "4", name: "Oat Milk Latte", category: "Coffee", sellingPrice: 15.00, cogs: 7.55, cogsPercent: 50.3, ingredients: [
    { product: "Oatmilk (Oatside)", sku: "DO001", qty: 200, uom: "ml", cost: 5.20 },
    { product: "Espresso Shot", sku: "CB001", qty: 30, uom: "ml", cost: 1.50 },
    { product: "Plastic Cup", sku: "PC003", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Iced Strawless Lid", sku: "PL002", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Ice", sku: "ICE01", qty: 150, uom: "g", cost: 0.25 },
  ]},
  { id: "5", name: "Smoked Duck Sandwich", category: "Food", sellingPrice: 16.00, cogs: 8.20, cogsPercent: 51.3, ingredients: [
    { product: "Smoked Duck", sku: "M0006", qty: 80, uom: "g", cost: 3.60 },
    { product: "Bread Slice", sku: "BR001", qty: 2, uom: "pcs", cost: 0.80 },
    { product: "Anchor Cheese Slice", sku: "RMA03", qty: 1, uom: "pcs", cost: 1.20 },
    { product: "Pesto", sku: "SP006", qty: 10, uom: "g", cost: 0.60 },
    { product: "Air Fryer Paper", sku: "PAP001", qty: 1, uom: "pcs", cost: 0.04 },
    { product: "Paperbag M", sku: "PP0002", qty: 1, uom: "pcs", cost: 0.15 },
  ]},
];

const CATEGORIES = ["All", "Coffee", "Non-Coffee", "Food", "Pastry"];

export default function MenusPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = MENUS.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || m.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Menu & Recipes (BOM)</h2>
          <p className="mt-0.5 text-sm text-gray-500">{MENUS.length} menu items with ingredient costing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="mr-1.5 h-4 w-4" />Import CSV</Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-terracotta hover:bg-terracotta-dark"><Plus className="mr-1.5 h-4 w-4" />Add Menu</Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search menu items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${catFilter === c ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500"}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Menu table with expandable ingredients */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="w-8 px-3 py-3"></th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Menu Item</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Selling Price</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">COGS</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">COGS %</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Margin</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ingredients</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((menu) => (
              <Fragment key={menu.id}>
                <tr className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedId(expandedId === menu.id ? null : menu.id)}>
                  <td className="px-3 py-3">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === menu.id ? "rotate-180" : ""}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-gray-400" />
                      <p className="font-medium text-gray-900">{menu.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{menu.category}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">RM {menu.sellingPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">RM {menu.cogs.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${menu.cogsPercent > 40 ? "text-red-600" : menu.cogsPercent > 30 ? "text-terracotta" : "text-green-600"}`}>
                      {menu.cogsPercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">RM {(menu.sellingPrice - menu.cogs).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{menu.ingredients.length} items</td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><Pencil className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
                {expandedId === menu.id && (
                  <tr>
                    <td colSpan={9} className="bg-gray-50 px-8 py-3">
                      <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">Recipe / Bill of Materials</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="pb-1 text-left font-medium">Ingredient</th>
                            <th className="pb-1 text-left font-medium">SKU</th>
                            <th className="pb-1 text-right font-medium">Qty</th>
                            <th className="pb-1 text-left font-medium">UOM</th>
                            <th className="pb-1 text-right font-medium">Cost (RM)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {menu.ingredients.map((ing, i) => (
                            <tr key={i} className="border-t border-gray-200/50">
                              <td className="py-1.5 text-gray-700">{ing.product}</td>
                              <td className="py-1.5"><code className="text-gray-500">{ing.sku}</code></td>
                              <td className="py-1.5 text-right text-gray-700">{ing.qty}</td>
                              <td className="py-1.5 text-gray-500">{ing.uom}</td>
                              <td className="py-1.5 text-right text-gray-700">{ing.cost.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-300">
                            <td colSpan={4} className="py-1.5 font-semibold text-gray-700">Total COGS</td>
                            <td className="py-1.5 text-right font-semibold text-gray-900">RM {menu.cogs.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* COGS Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Avg COGS %</p>
          <p className="text-xl font-bold text-gray-900">{(MENUS.reduce((a, m) => a + m.cogsPercent, 0) / MENUS.length).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">Target: &lt;30%</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Highest COGS</p>
          <p className="text-xl font-bold text-red-600">{MENUS.reduce((a, m) => m.cogsPercent > a.cogsPercent ? m : a).name}</p>
          <p className="text-xs text-gray-400">{MENUS.reduce((a, m) => m.cogsPercent > a.cogsPercent ? m : a).cogsPercent}%</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Total Menu Items</p>
          <p className="text-xl font-bold text-gray-900">{MENUS.length}</p>
          <p className="text-xs text-gray-400">{MENUS.reduce((a, m) => a + m.ingredients.length, 0)} ingredients mapped</p>
        </Card>
      </div>
    </div>
  );
}
