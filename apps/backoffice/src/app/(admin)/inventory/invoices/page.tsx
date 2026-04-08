"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Download, Eye, Image as ImageIcon, Loader2, CheckCircle2, Clock, AlertTriangle, Wallet, Building2 } from "lucide-react";

type Invoice = {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  outlet: string;
  supplier: string;
  amount: number;
  status: string;
  paymentType: string;
  claimedBy: string | null;
  issueDate: string;
  dueDate: string | null;
  hasPhoto: boolean;
  photoCount: number;
  notes: string | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadInvoices = () => {
    fetch("/api/inventory/invoices")
      .then((res) => { if (!res.ok) throw new Error("Failed to load invoices"); return res.json(); })
      .then((data) => { setInvoices(data); setError(null); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { loadInvoices(); }, []);

  const updateStatus = async (invoiceId: string, newStatus: string) => {
    if (newStatus === "PAID" || newStatus === "OVERDUE") {
      if (!confirm(newStatus === "PAID" ? "Mark this invoice as paid?" : "Mark payment as initiated?")) return;
    }
    setUpdatingId(invoiceId);
    try {
      const res = await fetch(`/api/inventory/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { alert("Failed to update invoice status."); return; }
      loadInvoices();
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = invoices.filter((i) => {
    const matchFilter = filter === "all" || i.status === filter.toUpperCase();
    const matchType = typeFilter === "all" || i.paymentType === typeFilter;
    const matchSearch = i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier.toLowerCase().includes(search.toLowerCase()) ||
      i.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      (i.claimedBy?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchFilter && matchType && matchSearch;
  });

  // DB uses PENDING/OVERDUE/PAID; UI shows Payment/Initiated/Paid
  const totalPayment = invoices.filter((i) => i.status === "PENDING").reduce((a, i) => a + i.amount, 0);
  const totalInitiated = invoices.filter((i) => i.status === "OVERDUE").reduce((a, i) => a + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amount, 0);
  const totalAll = invoices.reduce((a, i) => a + i.amount, 0);
  const totalPayClaim = invoices.filter((i) => i.paymentType === "PAY_CLAIM").reduce((a, i) => a + i.amount, 0);
  const payClaimPending = invoices.filter((i) => i.paymentType === "PAY_CLAIM" && i.status !== "PAID").reduce((a, i) => a + i.amount, 0);

  const STATUS_LABELS: Record<string, string> = {
    PENDING: "Payment",
    OVERDUE: "Initiated",
    PAID: "Paid",
    DRAFT: "Draft",
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "PAID": return "bg-green-500";
      case "OVERDUE": return "bg-blue-500";
      case "PENDING": return "bg-terracotta";
      default: return "bg-gray-400";
    }
  };

  const getActions = (status: string) => {
    switch (status) {
      case "PENDING": return [
        { status: "OVERDUE", label: "Mark Initiated", color: "bg-blue-500 hover:bg-blue-600" },
      ];
      case "OVERDUE": return [
        { status: "PAID", label: "Mark Paid", color: "bg-green-500 hover:bg-green-600" },
      ];
      case "PAID": return [];
      default: return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
          <p className="mt-0.5 text-sm text-gray-500">{invoices.length} invoices &middot; Track and reconcile supplier invoices</p>
        </div>
      </div>

      {/* Summary cards */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">RM {totalAll.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Payment</p><p className="text-lg font-bold text-terracotta">RM {totalPayment.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Initiated</p><p className="text-lg font-bold text-blue-600">RM {totalInitiated.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Paid</p><p className="text-lg font-bold text-green-600">RM {totalPaid.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5 border-orange-200 bg-orange-50/30"><p className="text-xs text-gray-500 flex items-center gap-1"><Wallet className="h-3 w-3" />Pay & Claim</p><p className="text-lg font-bold text-orange-600">RM {payClaimPending.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-gray-400">of RM {totalPayClaim.toLocaleString("en-MY", { minimumFractionDigits: 2 })} total</p></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {[{ key: "all", label: "All" }, { key: "pending", label: "Payment" }, { key: "overdue", label: "Initiated" }, { key: "paid", label: "Paid" }].map((s) => (
            <button key={s.key} onClick={() => setFilter(s.key)} className={`rounded-full border px-3 py-1 text-xs ${filter === s.key ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500"}`}>{s.label}</button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex gap-1.5">
          {[{ key: "all", label: "All Types", icon: null }, { key: "SUPPLIER", label: "Supplier", icon: Building2 }, { key: "PAY_CLAIM", label: "Pay & Claim", icon: Wallet }].map((t) => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)} className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${typeFilter === t.key ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500"}`}>
              {t.icon && <t.icon className="h-3 w-3" />}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50/50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">PO Ref</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Supplier</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Outlet</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Amount (RM)</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Claimed By</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Photo</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    {invoices.length === 0
                      ? "No invoices yet. Invoices will be created from receivings."
                      : "No invoices match your filter."}
                  </p>
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const actions = getActions(inv.status);
              return (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    {inv.paymentType === "PAY_CLAIM" ? (
                      <Badge className="bg-orange-500 text-[10px] flex items-center gap-0.5 w-fit"><Wallet className="h-2.5 w-2.5" />Claim</Badge>
                    ) : (
                      <Badge className="bg-gray-400 text-[10px] flex items-center gap-0.5 w-fit"><Building2 className="h-2.5 w-2.5" />Supplier</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{inv.poNumber}</code></td>
                  <td className="px-4 py-3 text-gray-600">{inv.supplier}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inv.outlet}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${statusColor(inv.status)}`}>{STATUS_LABELS[inv.status] || inv.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inv.issueDate}</td>
                  <td className="px-4 py-3 text-right font-medium">{inv.amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{inv.paymentType === "PAY_CLAIM" ? (inv.claimedBy ?? "—") : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">{inv.hasPhoto ? <ImageIcon className="h-4 w-4 text-green-500" /> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {actions.map((a) => (
                        <button
                          key={a.status}
                          onClick={() => updateStatus(inv.id, a.status)}
                          disabled={updatingId === inv.id}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium text-white ${a.color} disabled:opacity-50`}
                        >
                          {updatingId === inv.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            a.label
                          )}
                        </button>
                      ))}
                      {actions.length === 0 && inv.status === "PAID" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
