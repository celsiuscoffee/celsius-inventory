"use client";

import { useState, useRef } from "react";
import { useFetch } from "@/lib/use-fetch";
import { Card } from "@/components/ui/card";
import { Loader2, ChevronDown, ChevronRight, ShieldCheck, Download, CheckCircle2, Upload, Paperclip, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StatementItem = {
  campaignId: string;
  campaignName: string;
  outletId: string | null;
  outletName: string | null;
  subtotalMYR: number;
  taxMYR: number;
  totalMYR: number;
};

type Payment = {
  id: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  popPhotos: string[];
};

type MonthStatement = {
  yearMonth: string;
  items: StatementItem[];
  subtotalMYR: number;
  taxMYR: number;
  totalMYR: number;
  payment: Payment | null;
};

type Data = {
  year: number;
  sstRate: number;
  statements: MonthStatement[];
  summary: { subtotalMYR: number; taxMYR: number; totalMYR: number; monthCount: number };
  filters: { outletId: string | null; campaignId: string | null };
};

function fmtMYR(n: number): string {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 2 }).format(n);
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
}

function downloadCsv(data: Data) {
  const rows: string[] = ["Month,Campaign,Outlet,Subtotal (MYR),SST 8% (MYR),Total (MYR)"];
  for (const m of data.statements) {
    for (const i of m.items) {
      rows.push([
        m.yearMonth,
        `"${i.campaignName.replace(/"/g, '""')}"`,
        i.outletName ?? "",
        i.subtotalMYR.toFixed(2),
        i.taxMYR.toFixed(2),
        i.totalMYR.toFixed(2),
      ].join(","));
    }
  }
  rows.push([`Total ${data.year}`, "", "", data.summary.subtotalMYR.toFixed(2), data.summary.taxMYR.toFixed(2), data.summary.totalMYR.toFixed(2)].join(","));
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ads-statement-${data.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
  const currentYear = new Date().getUTCFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [outletId, setOutletId] = useState<string>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const qs = new URLSearchParams({ year: String(selectedYear) });
  if (outletId !== "all") qs.set("outletId", outletId);
  if (campaignId !== "all") qs.set("campaignId", campaignId);

  const { data, isLoading, mutate } = useFetch<Data>(`/api/ads/invoices?${qs.toString()}`);
  const { data: outletList } = useFetch<Array<{ id: string; name: string }>>("/api/ops/outlets");
  const { data: campaignData } = useFetch<{ campaigns: Array<{ id: string; name: string; outletId: string | null }> }>("/api/ads/campaigns?days=365");

  // Payment modal state
  const [payDialog, setPayDialog] = useState<MonthStatement | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [payPaidAt, setPayPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<string>("CARD");
  const [payRef, setPayRef] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [popBusy, setPopBusy] = useState<string | null>(null);
  const popFileRef = useRef<HTMLInputElement>(null);

  function openPayModal(m: MonthStatement) {
    setPayDialog(m);
    setPayPaidAt(new Date().toISOString().slice(0, 10));
    setPayMethod(m.payment?.paymentMethod ?? "CARD");
    setPayRef(m.payment?.referenceNumber ?? "");
    setPayNotes("");
  }

  async function submitPayment() {
    if (!payDialog) return;
    setPaySaving(true);
    try {
      // Create payment if none exists
      let paymentId = payDialog.payment?.id;
      if (!paymentId) {
        const createRes = await fetch("/api/ads/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearMonth: payDialog.yearMonth,
            outletId: data?.filters.outletId ?? null,
            campaignId: data?.filters.campaignId ?? null,
            subtotalMYR: payDialog.subtotalMYR,
            taxMYR: payDialog.taxMYR,
            totalMYR: payDialog.totalMYR,
          }),
        });
        if (!createRes.ok) throw new Error("Failed to create payment");
        const j = await createRes.json();
        paymentId = j.id;
      }
      // Mark paid
      const patchRes = await fetch(`/api/ads/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_paid",
          paidAt: payPaidAt,
          paymentMethod: payMethod,
          referenceNumber: payRef,
          notes: payNotes,
        }),
      });
      if (!patchRes.ok) throw new Error("Failed to mark paid");
      await mutate();
      setPayDialog(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setPaySaving(false);
    }
  }

  async function uploadPop(m: MonthStatement, file: File) {
    setPopBusy(m.yearMonth);
    try {
      // Ensure payment exists
      let paymentId = m.payment?.id;
      if (!paymentId) {
        const createRes = await fetch("/api/ads/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearMonth: m.yearMonth,
            outletId: data?.filters.outletId ?? null,
            campaignId: data?.filters.campaignId ?? null,
            subtotalMYR: m.subtotalMYR,
            taxMYR: m.taxMYR,
            totalMYR: m.totalMYR,
          }),
        });
        if (!createRes.ok) throw new Error("Failed to create payment");
        paymentId = (await createRes.json()).id;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/ads/payments/${paymentId}/pop`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload error");
    } finally {
      setPopBusy(null);
    }
  }

  async function viewPop(paymentId: string, path: string) {
    const res = await fetch(`/api/ads/payments/${paymentId}/pop?path=${encodeURIComponent(path)}`);
    if (!res.ok) { alert("Cannot load POP"); return; }
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  // Filter campaign options by selected outlet
  const campaignOptions = (campaignData?.campaigns ?? []).filter((c) => {
    if (outletId === "all") return true;
    if (outletId === "unlinked") return c.outletId == null;
    return c.outletId === outletId;
  });

  if (isLoading || !data) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;
  }

  function toggle(ym: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym); else next.add(ym);
      return next;
    });
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ads Statements</h1>
          <p className="text-xs text-neutral-500">Per-campaign monthly spend with 8% SST (Service Tax on digital services, MY)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={outletId}
            onChange={(e) => { setOutletId(e.target.value); setCampaignId("all"); }}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">All outlets</option>
            <option value="unlinked">Unlinked</option>
            {outletList?.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => downloadCsv(data)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* YTD summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Subtotal {selectedYear}</div>
          <div className="mt-1 text-xl font-semibold">{fmtMYR(data.summary.subtotalMYR)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">SST (8%)</div>
          <div className="mt-1 text-xl font-semibold">{fmtMYR(data.summary.taxMYR)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Total w/ Tax</div>
          <div className="mt-1 text-xl font-semibold">{fmtMYR(data.summary.totalMYR)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-neutral-500">Months</div>
          <div className="mt-1 text-xl font-semibold">{data.summary.monthCount}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Generated from actual spend data synced daily from Google Ads API. Retain CSV + this report for 7 years per LHDN requirements.
        </div>

        {data.statements.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-500">
            No spend data for {selectedYear}. Run a sync from Settings to pull historical metrics.
          </p>
        ) : (
          <div>
            {data.statements.map((m) => {
              const isOpen = expanded.has(m.yearMonth);
              const p = m.payment;
              const statusBadge = (() => {
                if (!p) return <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Outstanding</span>;
                if (p.status === "PAID") return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700"><CheckCircle2 className="h-3 w-3" />Paid</span>;
                if (p.status === "INITIATED") return <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-700">Initiated</span>;
                if (p.status === "VERIFIED") return <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-700"><ShieldCheck className="h-3 w-3" />Verified</span>;
                return <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">{p.status}</span>;
              })();

              return (
                <div key={m.yearMonth} className="border-b border-neutral-100 last:border-0">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                    <button
                      onClick={() => toggle(m.yearMonth)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
                      <span className="font-medium">{fmtMonth(m.yearMonth)}</span>
                      <span className="text-xs text-neutral-400">({m.items.length} campaigns)</span>
                      {statusBadge}
                    </button>
                    <div className="flex items-center gap-4 text-sm tabular-nums">
                      <span className="text-neutral-500">{fmtMYR(m.subtotalMYR)}</span>
                      <span className="text-neutral-500">+{fmtMYR(m.taxMYR)} SST</span>
                      <span className="font-semibold min-w-[90px] text-right">{fmtMYR(m.totalMYR)}</span>
                      <button
                        onClick={() => openPayModal(m)}
                        className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50"
                      >
                        {p?.status === "PAID" ? "Edit" : "Mark as Paid"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-neutral-500">
                            <th className="px-4 py-2 text-left font-normal">Campaign</th>
                            <th className="px-4 py-2 text-left font-normal">Outlet</th>
                            <th className="px-4 py-2 text-right font-normal">Subtotal</th>
                            <th className="px-4 py-2 text-right font-normal">SST 8%</th>
                            <th className="px-4 py-2 text-right font-normal">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.items.map((i) => (
                            <tr key={i.campaignId} className="border-t border-neutral-100">
                              <td className="px-4 py-2">{i.campaignName}</td>
                              <td className="px-4 py-2 text-xs text-neutral-500">{i.outletName ?? "—"}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{fmtMYR(i.subtotalMYR)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{fmtMYR(i.taxMYR)}</td>
                              <td className="px-4 py-2 text-right font-medium tabular-nums">{fmtMYR(i.totalMYR)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Payment details + POP */}
                      {p && (
                        <div className="flex flex-wrap items-center gap-4 border-t border-neutral-100 bg-white px-4 py-3 text-xs">
                          {p.paidAt && <span>Paid: <span className="font-medium">{new Date(p.paidAt).toLocaleDateString("en-MY")}</span></span>}
                          {p.paymentMethod && <span>Method: <span className="font-medium">{p.paymentMethod}</span></span>}
                          {p.referenceNumber && <span>Ref: <span className="font-mono">{p.referenceNumber}</span></span>}
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500">POP:</span>
                            {p.popPhotos.length === 0 && <span className="text-neutral-400">none</span>}
                            {p.popPhotos.map((path, idx) => (
                              <button
                                key={path}
                                onClick={() => viewPop(p.id, path)}
                                className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 hover:bg-neutral-50"
                              >
                                <FileText className="h-3 w-3" /> #{idx + 1}
                              </button>
                            ))}
                            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 hover:bg-neutral-50">
                              {popBusy === m.yearMonth ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                              Upload
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadPop(m, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Mark as Paid Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(v) => !v && setPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {payDialog?.payment?.status === "PAID" ? "Edit Payment" : "Mark as Paid"}
              {payDialog && <span className="block text-xs font-normal text-neutral-500">{fmtMonth(payDialog.yearMonth)} · {fmtMYR(payDialog.totalMYR)}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Paid date</label>
              <input
                type="date"
                value={payPaidAt}
                onChange={(e) => setPayPaidAt(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Payment method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="CARD">Company card</option>
                <option value="PERSONAL_CARD">Personal card (claim)</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="GOOGLE_CREDIT">Google credit</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Reference number</label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Google receipt ID / bank ref"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Notes (optional)</label>
              <textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={submitPayment}
              disabled={paySaving}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-50"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save as Paid
            </button>
            <p className="text-[10px] text-neutral-400">
              After marking paid, you can upload proof-of-payment (POP) screenshots/PDFs on the expanded row.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
