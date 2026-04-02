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
import { Plus, Pencil, Building2, MapPin, Phone } from "lucide-react";

const BRANCHES = [
  { id: "1", code: "CC001", name: "Celsius Coffee IOI Conezion", type: "Branch" as const, status: "active" as const, address: "M-G-06 Persiaran IRC3, IOI City Resort, 62502 Putrajaya", city: "Putrajaya", state: "Putrajaya", phone: "+60172096058", staffCount: 2, productCount: 450 },
  { id: "2", code: "CC002", name: "Celsius Coffee Shah Alam", type: "Branch" as const, status: "active" as const, address: "58, Jalan Renang 13/26, Tadisma Business Park, 40100 Shah Alam, Selangor", city: "Shah Alam", state: "Selangor", phone: "+60172096058", staffCount: 1, productCount: 450 },
  { id: "3", code: "CC003", name: "Celsius Coffee Tamarind", type: "Branch" as const, status: "active" as const, address: "K-05, Level 3m, Tamarind Square, 63000 Cyberjaya, Selangor", city: "Cyberjaya", state: "Selangor", phone: "+60172096058", staffCount: 1, productCount: 450 },
  { id: "4", code: "CF Nilai", name: "Celsius Coffee Nilai", type: "Branch" as const, status: "active" as const, address: "Persiaran Korporat, 71800 Nilai, Negeri Sembilan", city: "Nilai", state: "Negeri Sembilan", phone: "+60172096058", staffCount: 0, productCount: 450 },
  { id: "5", code: "CF IOI Mall", name: "Celsius Coffee IOI Mall", type: "Branch" as const, status: "inactive" as const, address: "M-G-06 Persiaran IRC3, IOI City Resort, 62502 Putrajaya", city: "Putrajaya", state: "Putrajaya", phone: "+60172096058", staffCount: 0, productCount: 0 },
];

type BranchForm = { name: string; code: string; type: string; address: string; city: string; state: string; phone: string };
const emptyForm: BranchForm = { name: "", code: "", type: "Branch", address: "", city: "", state: "", phone: "" };

export default function BranchesPage() {
  const [filter, setFilter] = useState<"all" | "Branch" | "Central kitchen">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);

  const filtered = BRANCHES.filter((b) => filter === "all" || b.type === filter);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (b: (typeof BRANCHES)[0]) => {
    setForm({ name: b.name, code: b.code, type: b.type, address: b.address, city: b.city, state: b.state, phone: b.phone });
    setEditingId(b.id);
    setDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Branches</h2>
          <p className="mt-0.5 text-sm text-gray-500">{BRANCHES.filter((b) => b.status === "active").length} active outlets</p>
        </div>
        <Button onClick={openAdd} className="bg-terracotta hover:bg-terracotta-dark">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Branch
        </Button>
      </div>

      <div className="mt-4 flex gap-1.5">
        {(["all", "Branch", "Central kitchen"] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${filter === t ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            {t === "all" ? "All" : t}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Branch Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Branch Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Address</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Staff</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Products</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((branch) => (
              <tr key={branch.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-terracotta">{branch.code}</code></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{branch.name}</p>
                      <p className="text-xs text-gray-400">{branch.type}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] ${branch.status === "active" ? "bg-green-500" : "bg-gray-400"}`}>
                    {branch.status === "active" ? "Active" : "Deactivated"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{branch.address}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{branch.phone}</td>
                <td className="px-4 py-3 text-gray-600">{branch.staffCount}</td>
                <td className="px-4 py-3 text-gray-600">{branch.productCount}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(branch)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700">Branch Name</label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-gray-700">Branch Code</label><Input className="mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Type</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="Branch">Branch (Outlet)</option>
                  <option value="Central kitchen">Central Kitchen</option>
                </select>
              </div>
              <div><label className="text-sm font-medium text-gray-700">Phone</label><Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700">Address</label><Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700">City</label><Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-gray-700">State</label><Input className="mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            </div>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">{editingId ? "Save Changes" : "Add Branch"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
