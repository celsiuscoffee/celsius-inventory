"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Download, Eye, Image as ImageIcon } from "lucide-react";

const INVOICES = [
  { id: "INV-001", poNumber: "CC-IOI-0039", supplier: "Unique Paper Sdn Bhd", branch: "IOI Conezion", amount: 42.00, status: "paid" as const, issueDate: "28/03/2026", dueDate: "04/04/2026", hasPhoto: true },
  { id: "INV-002", poNumber: "CC-IOI-0037", supplier: "BGS Trading", branch: "IOI Conezion", amount: 89.50, status: "pending" as const, issueDate: "26/03/2026", dueDate: "02/04/2026", hasPhoto: true },
  { id: "INV-003", poNumber: "CC-SHA-0015", supplier: "Sri Ternak", branch: "Shah Alam", amount: 180.00, status: "pending" as const, issueDate: "30/03/2026", dueDate: "06/04/2026", hasPhoto: false },
  { id: "INV-004", poNumber: "CC-TMR-0012", supplier: "Dankoff", branch: "Tamarind", amount: 312.00, status: "overdue" as const, issueDate: "20/03/2026", dueDate: "27/03/2026", hasPhoto: true },
  { id: "INV-005", poNumber: "CC-IOI-0042", supplier: "Sri Ternak", branch: "IOI Conezion", amount: 180.00, status: "draft" as const, issueDate: "01/04/2026", dueDate: "08/04/2026", hasPhoto: false },
];

export default function InvoicesPage() {
  const [filter, setFilter] = useState<"all" | "draft" | "pending" | "paid" | "overdue">("all");
  const filtered = INVOICES.filter((i) => filter === "all" || i.status === filter);
  const totalPending = INVOICES.filter((i) => i.status === "pending").reduce((a, i) => a + i.amount, 0);
  const totalOverdue = INVOICES.filter((i) => i.status === "overdue").reduce((a, i) => a + i.amount, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Invoices</h2>
          <p className="mt-0.5 text-sm text-gray-500">Track and reconcile supplier invoices</p>
        </div>
        <Button className="bg-terracotta hover:bg-terracotta-dark"><FileText className="mr-1.5 h-4 w-4" />Generate Invoice</Button>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">RM {INVOICES.reduce((a, i) => a + i.amount, 0).toFixed(2)}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-terracotta">RM {totalPending.toFixed(2)}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Overdue</p><p className="text-lg font-bold text-red-600">RM {totalOverdue.toFixed(2)}</p></div>
        <div className="rounded-lg border bg-white px-3 py-2.5"><p className="text-xs text-gray-500">Paid</p><p className="text-lg font-bold text-green-600">RM {INVOICES.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount, 0).toFixed(2)}</p></div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input placeholder="Search invoices..." className="pl-9" /></div>
        <div className="flex gap-1.5">
          {(["all", "draft", "pending", "paid", "overdue"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === s ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50/50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">Invoice ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">PO Ref</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Supplier</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Issue Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Amount (RM)</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Photo</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{inv.id}</td>
                <td className="px-4 py-3"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{inv.poNumber}</code></td>
                <td className="px-4 py-3 text-gray-600">{inv.supplier}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{inv.branch}</td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] ${inv.status === "paid" ? "bg-green-500" : inv.status === "pending" ? "bg-terracotta" : inv.status === "overdue" ? "bg-red-500" : "bg-gray-400"}`}>{inv.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{inv.issueDate}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{inv.dueDate}</td>
                <td className="px-4 py-3 text-right font-medium">{inv.amount.toFixed(2)}</td>
                <td className="px-4 py-3">{inv.hasPhoto ? <ImageIcon className="h-4 w-4 text-green-500" /> : <span className="text-xs text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><Eye className="h-3.5 w-3.5" /></button>
                    <button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
