"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import bcryptjs from "bcryptjs";

const ROLE_COLORS: Record<string, string> = { admin: "bg-purple-500/20 text-purple-400", manager: "bg-blue-500/20 text-blue-400", staff: "bg-surface text-text-muted" };

const OUTLETS = [
  { id: "outlet-sa", name: "Shah Alam" },
  { id: "outlet-con", name: "Conezion" },
  { id: "outlet-tam", name: "Tamarind Square" },
];

export default function StaffPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("staff");
  const [formPin, setFormPin] = useState("");
  const [formOutlet, setFormOutlet] = useState("");

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("staff_users").select("*").order("name");
    setStaffList(data ?? []);
  }, [supabase]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  function resetForm() {
    setFormName(""); setFormPhone(""); setFormEmail("");
    setFormRole("staff"); setFormPin(""); setFormOutlet("");
    setError("");
  }

  async function handleAddStaff() {
    if (!formName.trim()) { setError("Name is required"); return; }
    if (!formPin || formPin.length < 4) { setError("PIN must be at least 4 digits"); return; }

    setSaving(true);
    setError("");

    try {
      const pinHash = await bcryptjs.hash(formPin, 10);
      const { error: dbError } = await supabase.from("staff_users").insert({
        name: formName.trim(),
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        role: formRole,
        pin_hash: pinHash,
        outlet_id: formOutlet || null,
        is_active: true,
      });

      if (dbError) throw dbError;

      resetForm();
      setShowAdd(false);
      await loadStaff();
    } catch (err: any) {
      setError(err.message ?? "Failed to add staff");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await supabase.from("staff_users").update({ is_active: !currentActive }).eq("id", id);
    await loadStaff();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Staff</h1><p className="mt-1 text-sm text-text-muted">{staffList.length} employees</p></div>
        <button onClick={() => { resetForm(); setShowAdd(true); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">+ Add Staff</button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-surface-raised text-left text-xs font-medium text-text-muted">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3 text-center">Active</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {staffList.map((s) => (
              <tr key={s.id} className="hover:bg-surface-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">{s.name.charAt(0)}</div>
                    <div><p className="text-sm font-medium">{s.name}</p>{s.email && <p className="text-[10px] text-text-dim">{s.email}</p>}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-text-muted">{s.phone ?? "-"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[s.role] ?? ""}`}>{s.role}</span></td>
                <td className="px-4 py-3 text-sm text-text-muted">{OUTLETS.find((o) => o.id === s.outlet_id)?.name ?? "All"}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleToggleActive(s.id, s.is_active)} title={s.is_active ? "Click to deactivate" : "Click to activate"}>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.is_active ? "bg-success" : "bg-danger"}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Add Staff</h3>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-text-muted">Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Phone</label>
                <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder="+60..." />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Role *</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand">
                  <option value="staff">Staff (Cashier)</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">PIN (6 digits) *</label>
                <input type="password" maxLength={6} value={formPin} onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text font-mono outline-none focus:border-brand" placeholder="******" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-text-muted">Outlet</label>
                <select value={formOutlet} onChange={(e) => setFormOutlet(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand">
                  <option value="">All Outlets</option>
                  {OUTLETS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
              <button onClick={handleAddStaff} disabled={saving}
                className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                {saving ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
