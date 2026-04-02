"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Phone, Mail } from "lucide-react";

const STAFF = [
  { id: "1", name: "Adam Kelvin", role: "Company Admin" as const, branch: "Company", phone: "+60176579149", email: "", status: "active" as const, addedDate: "16/03/2026" },
  { id: "2", name: "Ariff", role: "Company Admin" as const, branch: "Company", phone: "+60163230590", email: "", status: "active" as const, addedDate: "16/03/2026" },
  { id: "3", name: "Ammar", role: "Company Admin" as const, branch: "Company", phone: "+60109335369", email: "", status: "active" as const, addedDate: "16/03/2026" },
  { id: "4", name: "Syafa Test", role: "Branch Staff" as const, branch: "Celsius Coffee IOI Conezion", phone: "+60143803275", email: "", status: "active" as const, addedDate: "16/03/2026" },
  { id: "5", name: "Syerry Tg", role: "Branch Staff" as const, branch: "Celsius Coffee Shah Alam", phone: "+601123864244", email: "tengkusyahirahbalqis@gmail.com", status: "active" as const, addedDate: "30/03/2026" },
  { id: "6", name: "Aina", role: "Branch Staff" as const, branch: "Celsius Coffee Tamarind", phone: "+60142317167", email: "aiynakook13@gmail.com", status: "active" as const, addedDate: "30/03/2026" },
  { id: "7", name: "Adam Haziq", role: "Branch Staff" as const, branch: "Celsius Coffee IOI Conezion", phone: "+601155073019", email: "damjeeq1@gmail.com", status: "active" as const, addedDate: "30/03/2026" },
];

type StaffForm = { name: string; role: string; branch: string; phone: string; email: string };
const emptyForm: StaffForm = { name: "", role: "Branch Staff", branch: "", phone: "", email: "" };

export default function StaffPage() {
  const [filter, setFilter] = useState<"all" | "active" | "deactivated">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const filtered = STAFF.filter((s) => filter === "all" || s.status === filter);
  const openAdd = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Staff</h2>
          <p className="mt-0.5 text-sm text-gray-500">{STAFF.length} members across {new Set(STAFF.map((s) => s.branch)).size} locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Import Staff</Button>
          <Button onClick={openAdd} className="bg-terracotta hover:bg-terracotta-dark"><Plus className="mr-1.5 h-4 w-4" />Add User</Button>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {(["all", "active", "deactivated"] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${filter === t ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500"}`}>{t}</button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Assigned to</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Added</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((staff) => (
              <tr key={staff.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/10 text-xs font-bold text-terracotta-dark">{staff.name.charAt(0)}</div>
                    <p className="font-medium text-gray-900">{staff.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant="outline" className={`text-[10px] ${staff.role === "Company Admin" ? "border-terracotta text-terracotta" : ""}`}>{staff.role}</Badge></td>
                <td className="px-4 py-3 text-gray-600 text-xs">{staff.branch}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{staff.phone}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{staff.email || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{staff.addedDate}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Edit role</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><label className="text-sm font-medium">Name</label><Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Role</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="Company Admin">Company Admin</option>
                  <option value="Branch Manager">Branch Manager</option>
                  <option value="Branch Staff">Branch Staff</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assign to</label>
                <select className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                  <option value="Company">Company (All)</option>
                  <option value="Celsius Coffee IOI Conezion">IOI Conezion</option>
                  <option value="Celsius Coffee Shah Alam">Shah Alam</option>
                  <option value="Celsius Coffee Tamarind">Tamarind</option>
                  <option value="Celsius Coffee Nilai">Nilai</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Phone</label><Input className="mt-1" placeholder="+60..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Email</label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">Add Staff</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
