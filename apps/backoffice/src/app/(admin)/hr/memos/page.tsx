"use client";

import { useFetch } from "@/lib/use-fetch";
import { useState } from "react";
import { AlertTriangle, Award, FileText, Loader2, Plus, X, CheckCircle2, XCircle } from "lucide-react";

type Memo = {
  id: string;
  user_id: string;
  user_name: string | null;
  issued_by: string;
  issued_by_name: string | null;
  issued_at: string;
  type: "verbal_warning" | "written_warning" | "commendation" | "note";
  severity: "info" | "minor" | "major";
  title: string;
  body: string;
  related_type: string | null;
  related_id: string | null;
  acknowledged_at: string | null;
  status: "active" | "rescinded";
};

type Employee = { id: string; name: string; fullName: string | null };

const TYPE_META = {
  verbal_warning: { label: "Verbal Warning", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  written_warning: { label: "Written Warning", icon: AlertTriangle, color: "bg-red-100 text-red-700" },
  commendation: { label: "Commendation", icon: Award, color: "bg-green-100 text-green-700" },
  note: { label: "Note", icon: FileText, color: "bg-gray-100 text-gray-700" },
} as const;

export default function MemosPage() {
  const [status, setStatus] = useState<"active" | "rescinded" | "all">("active");
  const { data, mutate, isLoading } = useFetch<{ memos: Memo[] }>(`/api/hr/memos?status=${status}`);
  const { data: empData } = useFetch<{ employees: Employee[] }>("/api/hr/employees");

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    type: "note" as Memo["type"],
    severity: "info" as Memo["severity"],
    title: "",
    body: "",
  });
  const [saving, setSaving] = useState(false);

  const memos = data?.memos || [];
  const employees = empData?.employees || [];

  const submit = async () => {
    if (!form.user_id || !form.title || !form.body) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setCreating(false);
        setForm({ user_id: "", type: "note", severity: "info", title: "", body: "" });
        mutate();
      } else {
        const { error } = await res.json();
        alert(error || "Failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const rescind = async (id: string) => {
    const reason = window.prompt("Reason for rescinding this memo:");
    if (reason === null) return;
    const res = await fetch("/api/hr/memos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "rescind", reason }),
    });
    if (res.ok) mutate();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Memos & Warnings</h1>
          <p className="text-sm text-muted-foreground">
            Issue warnings, commendations, or notes to staff. Staff acknowledge in the staff app.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
        >
          <Plus className="h-4 w-4" /> New Memo
        </button>
      </div>

      <div className="flex gap-1 rounded-lg border bg-card p-1 text-sm w-fit">
        {(["active", "rescinded", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 font-medium capitalize ${status === s ? "bg-terracotta text-white" : "text-gray-600 hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : memos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border bg-card py-16">
          <FileText className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-semibold text-gray-500">No memos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((m) => {
            const meta = TYPE_META[m.type];
            const Icon = meta.icon;
            return (
              <div key={m.id} className={`rounded-xl border bg-card p-4 ${m.status === "rescinded" ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      {m.severity === "major" && <span className="text-xs font-medium text-red-700">MAJOR</span>}
                      {m.acknowledged_at ? (
                        <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3 w-3" /> Acknowledged</span>
                      ) : (
                        <span className="text-xs text-amber-600">Pending acknowledgement</span>
                      )}
                      {m.status === "rescinded" && <span className="flex items-center gap-1 text-xs text-gray-500"><XCircle className="h-3 w-3" /> Rescinded</span>}
                    </div>
                    <p className="font-semibold">{m.title}</p>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      To <strong>{m.user_name}</strong> · by {m.issued_by_name} · {new Date(m.issued_at).toLocaleString("en-MY")}
                    </p>
                  </div>
                  {m.status === "active" && (
                    <button
                      onClick={() => rescind(m.id)}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      Rescind
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">New Memo</h2>
              <button onClick={() => setCreating(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Staff</label>
                <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="w-full rounded border border-gray-300 px-3 py-2">
                  <option value="">— Select —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.fullName || e.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Memo["type"] })} className="w-full rounded border border-gray-300 px-3 py-2">
                    <option value="note">Note</option>
                    <option value="verbal_warning">Verbal Warning</option>
                    <option value="written_warning">Written Warning</option>
                    <option value="commendation">Commendation</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Memo["severity"] })} className="w-full rounded border border-gray-300 px-3 py-2">
                    <option value="info">Info</option>
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border border-gray-300 px-3 py-2" placeholder="e.g. Late arrival — 3rd occurrence" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Body</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} className="w-full rounded border border-gray-300 px-3 py-2" placeholder="Details of the incident, expectations, consequences..." />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button onClick={submit} disabled={saving || !form.user_id || !form.title || !form.body} className="rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue Memo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
