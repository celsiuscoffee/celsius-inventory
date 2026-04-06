"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const ROLE_COLORS: Record<string, string> = { admin: "bg-purple-500/20 text-purple-400", manager: "bg-blue-500/20 text-blue-400", staff: "bg-surface text-text-muted" };

export default function StaffPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("staff_users").select("*").order("name");
      setStaffList(data ?? []);
    }
    load();
  }, [supabase]);

  const SAMPLE_STAFF = staffList.map((s) => ({
    id: s.id, name: s.name, email: s.email, phone: "", role: s.role,
    branch: s.outlet_id ?? "All Branches", isActive: s.is_active,
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Staff</h1><p className="mt-1 text-sm text-text-muted">{SAMPLE_STAFF.length} employees</p></div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">+ Add Staff</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-center">Active</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {SAMPLE_STAFF.map((s) => (
              <tr key={s.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">{s.name.charAt(0)}</div><div><p className="text-sm font-medium">{s.name}</p>{s.email && <p className="text-[10px] text-text-dim">{s.email}</p>}</div></div></td>
                <td className="px-4 py-3 text-sm font-mono text-text-muted">{s.phone}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[s.role]}`}>{s.role}</span></td>
                <td className="px-4 py-3 text-sm text-text-muted">{s.branch}</td>
                <td className="px-4 py-3 text-center"><span className={`inline-block h-2.5 w-2.5 rounded-full ${s.isActive ? "bg-success" : "bg-danger"}`} /></td>
                <td className="px-4 py-3 text-right"><button className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-hover">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Add Staff</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="mb-1 block text-xs text-text-muted">Name *</label><input type="text" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Phone *</label><input type="tel" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder="+60..." /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Email</label><input type="email" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" /></div>
              <div><label className="mb-1 block text-xs text-text-muted">Role *</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option value="staff">Staff (Cashier)</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
              <div><label className="mb-1 block text-xs text-text-muted">PIN (4 digits) *</label><input type="password" maxLength={4} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text font-mono outline-none focus:border-brand" placeholder="****" /></div>
              <div className="col-span-2"><label className="mb-1 block text-xs text-text-muted">Branch</label><select className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand"><option>Shah Alam</option><option>IOI Conezion</option><option>Tamarind</option><option>All Branches</option></select></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">Add Staff</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
