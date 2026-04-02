"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

const CATEGORIES = [
  { id: "1", name: "Flavour", slug: "flavour", productCount: 28 },
  { id: "2", name: "Dairy", slug: "dairy", productCount: 22 },
  { id: "3", name: "Packaging", slug: "packaging", productCount: 45 },
  { id: "4", name: "Raw Material", slug: "raw-material", productCount: 18 },
  { id: "5", name: "Meat", slug: "meat", productCount: 8 },
  { id: "6", name: "Fresh Fruit", slug: "fresh-fruit", productCount: 15 },
  { id: "7", name: "Fresh Vegetable", slug: "fresh-vegetable", productCount: 12 },
  { id: "8", name: "Cleaning", slug: "cleaning", productCount: 10 },
  { id: "9", name: "Cookies", slug: "cookies", productCount: 14 },
  { id: "10", name: "Sauce", slug: "sauce", productCount: 16 },
  { id: "11", name: "Spread", slug: "spread", productCount: 9 },
  { id: "12", name: "Sweetener", slug: "sweetener", productCount: 14 },
];

export default function CategoriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const openAdd = () => { setName(""); setEditingId(null); setDialogOpen(true); };
  const openEdit = (cat: (typeof CATEGORIES)[0]) => { setName(cat.name); setEditingId(cat.id); setDialogOpen(true); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
          <p className="mt-0.5 text-sm text-gray-500">{CATEGORIES.length} product categories</p>
        </div>
        <Button onClick={openAdd} className="bg-terracotta hover:bg-terracotta-dark">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Tags className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{cat.name}</p>
                <p className="text-xs text-gray-500">{cat.productCount} products</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(cat)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Category Name</label>
              <Input className="mt-1" placeholder="e.g. Beverages" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">
              {editingId ? "Save" : "Add Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
