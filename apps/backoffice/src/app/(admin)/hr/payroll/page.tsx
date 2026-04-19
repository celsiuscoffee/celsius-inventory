"use client";

import { useFetch } from "@/lib/use-fetch";
import { useState } from "react";
import { Bot, Banknote, Loader2, CheckCircle2, FileText, CalendarDays, Download, FileSpreadsheet, Scale, X } from "lucide-react";
import Link from "next/link";

type PayrollRun = {
  id: string;
  period_month: number;
  period_year: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_cost: number;
  ai_notes: string | null;
  confirmed_at: string | null;
};

type PayrollItem = {
  id: string;
  user_id: string;
  basic_salary: number;
  total_ot_hours: number;
  ot_1_5x_amount: number;
  ot_2x_amount: number;
  ot_3x_amount: number;
  total_gross: number;
  epf_employee: number;
  socso_employee: number;
  eis_employee: number;
  pcb_tax: number;
  total_deductions: number;
  net_pay: number;
  computation_details: { employment_type: string; hourly_rate: number; attendance_records: number } | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, mutate } = useFetch<{ runs: PayrollRun[] }>("/api/hr/payroll");
  const [computing, setComputing] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [result, setResult] = useState<{ notes: string[] } | null>(null);
  const [viewRunId, setViewRunId] = useState<string | null>(null);
  const { data: detailData } = useFetch<{ run: PayrollRun; items: PayrollItem[] }>(
    viewRunId ? `/api/hr/payroll?run_id=${viewRunId}` : null,
  );

  const runs = data?.runs || [];
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [compareInput, setCompareInput] = useState("");
  const [compareResult, setCompareResult] = useState<{ summary: { rows_compared: number; matched: number; with_mismatches: number }; results: Array<{ name: string; matched: boolean; mismatches?: number; note?: string; comparisons?: Array<{ field: string; ours: number; theirs: number | undefined | null; diff: number | null; status: "match" | "near" | "mismatch" | "skipped" }> }> } | null>(null);
  const [comparing, setComparing] = useState(false);

  const downloadFile = (url: string) => {
    window.location.href = url;
  };

  const handleCompare = async () => {
    if (!compareRunId) return;
    setComparing(true);
    setCompareResult(null);
    try {
      // Parse TSV / CSV paste from BrioHR export
      // Expected columns (order-independent via header): name, ic_number, basic, ot, gross, epf, socso, eis, pcb, zakat, net
      const lines = compareInput.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        alert("Paste at least a header row and one data row");
        return;
      }
      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const brioRows = lines.slice(1).map((line) => {
        const cells = line.split(sep).map((c) => c.trim());
        const row: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const val = cells[i];
          if (val === undefined || val === "") return;
          if (["basic", "ot", "gross", "epf", "socso", "eis", "pcb", "zakat", "net"].includes(h)) {
            row[h] = parseFloat(val.replace(/[,RM\s]/g, ""));
          } else {
            row[h] = val;
          }
        });
        return row;
      });
      const res = await fetch("/api/hr/payroll/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: compareRunId, brio_rows: brioRows }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Compare failed");
        return;
      }
      setCompareResult(d);
    } finally {
      setComparing(false);
    }
  };

  const handleCompute = async () => {
    setComputing(true);
    setResult(null);
    try {
      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compute", month, year }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        mutate();
      } else {
        setResult({ notes: [data.error || "Failed"] });
      }
    } finally {
      setComputing(false);
    }
  };

  const handleConfirm = async (runId: string) => {
    setConfirming(runId);
    try {
      await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", run_id: runId }),
      });
      mutate();
    } finally {
      setConfirming(null);
    }
  };

  const fmt = (n: number) => `RM ${Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Payroll (Monthly · Full-Timers)</h1>
        <Link
          href="/hr/payroll/weekly"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <CalendarDays className="h-4 w-4" />
          Weekly (Part-Timers)
        </Link>
      </div>

      {/* Compute Controls */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Bot className="h-5 w-5 text-terracotta" />
          AI Payroll Calculator
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2 text-sm">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2 text-sm">
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </label>
          <button
            onClick={handleCompute}
            disabled={computing}
            className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-50"
          >
            {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            Compute Payroll
          </button>
        </div>
        {result && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
            {result.notes.map((n, i) => <p key={i} className="text-muted-foreground">{n}</p>)}
          </div>
        )}
      </div>

      {/* Payroll Runs */}
      <div className="space-y-3">
        {runs.map((run) => {
          const isComputed = run.status === "ai_computed";
          const isConfirmed = run.status === "confirmed";
          const isViewing = viewRunId === run.id;

          return (
            <div key={run.id} className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{MONTHS[run.period_month - 1]} {run.period_year}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isConfirmed ? "bg-green-100 text-green-700" :
                      isComputed ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {run.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                    <span>Gross: {fmt(run.total_gross)}</span>
                    <span>Net: {fmt(run.total_net)}</span>
                    <span>Employer: {fmt(run.total_employer_cost)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewRunId(isViewing ? null : run.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <FileText className="inline h-3 w-3 mr-1" />{isViewing ? "Hide" : "Details"}
                  </button>
                  {isComputed && (
                    <button
                      onClick={() => handleConfirm(run.id)}
                      disabled={confirming === run.id}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {confirming === run.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Confirm
                    </button>
                  )}
                  {isConfirmed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  <button
                    onClick={() => { setCompareRunId(run.id); setCompareInput(""); setCompareResult(null); }}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    title="Compare against BrioHR payslip data"
                  >
                    <Scale className="inline h-3 w-3 mr-1" />
                    Compare
                  </button>
                </div>
              </div>

              {/* Detail Table */}
              {isViewing && detailData?.items && (
                <div className="border-t px-4 pb-4 pt-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/payslip?run_id=${run.id}`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileText className="h-3 w-3" /> Payslips (all, PDF)
                    </button>
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/submission-files?run_id=${run.id}&type=maybank`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <Download className="h-3 w-3" /> Maybank M2u
                    </button>
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/submission-files?run_id=${run.id}&type=kwsp`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileSpreadsheet className="h-3 w-3" /> KWSP Form A
                    </button>
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/submission-files?run_id=${run.id}&type=perkeso`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileSpreadsheet className="h-3 w-3" /> PERKESO
                    </button>
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/submission-files?run_id=${run.id}&type=cp39`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileSpreadsheet className="h-3 w-3" /> CP39 (PCB)
                    </button>
                    <button
                      onClick={() => downloadFile(`/api/hr/payroll/submission-files?run_id=${run.id}&type=hrdf`)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <FileSpreadsheet className="h-3 w-3" /> HRDF
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-3">Employee</th>
                          <th className="pb-2 pr-3 text-right">Basic</th>
                          <th className="pb-2 pr-3 text-right">OT</th>
                          <th className="pb-2 pr-3 text-right">Gross</th>
                          <th className="pb-2 pr-3 text-right">EPF</th>
                          <th className="pb-2 pr-3 text-right">SOCSO</th>
                          <th className="pb-2 pr-3 text-right">EIS</th>
                          <th className="pb-2 pr-3 text-right">PCB</th>
                          <th className="pb-2 text-right font-semibold">Net</th>
                          <th className="pb-2 pl-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{item.user_id.slice(0, 8)}...</td>
                            <td className="py-2 pr-3 text-right">{fmt(item.basic_salary)}</td>
                            <td className="py-2 pr-3 text-right">
                              {Number(item.total_ot_hours) > 0 ? `${item.total_ot_hours}h` : "—"}
                            </td>
                            <td className="py-2 pr-3 text-right">{fmt(item.total_gross)}</td>
                            <td className="py-2 pr-3 text-right">{fmt(item.epf_employee)}</td>
                            <td className="py-2 pr-3 text-right">{fmt(item.socso_employee)}</td>
                            <td className="py-2 pr-3 text-right">{fmt(item.eis_employee)}</td>
                            <td className="py-2 pr-3 text-right">{fmt(item.pcb_tax)}</td>
                            <td className="py-2 text-right font-semibold">{fmt(item.net_pay)}</td>
                            <td className="py-2 pl-2">
                              <button
                                onClick={() => downloadFile(`/api/hr/payroll/payslip?run_id=${run.id}&user_id=${item.user_id}`)}
                                className="text-terracotta hover:underline text-xs"
                                title="Download payslip PDF"
                              >
                                PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {run.ai_notes && !isViewing && (
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">{run.ai_notes}</p>
              )}
            </div>
          );
        })}

        {runs.length === 0 && (
          <div className="rounded-xl border bg-card py-16 text-center">
            <Banknote className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-lg font-semibold">No payroll runs yet</p>
            <p className="text-sm text-muted-foreground">Use the AI calculator above to compute</p>
          </div>
        )}
      </div>

      {/* Compare vs BrioHR modal */}
      {compareRunId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setCompareRunId(null)}>
          <div className="mt-8 w-full max-w-4xl rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Scale className="h-5 w-5 text-terracotta" />
                  Compare against BrioHR payroll
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paste a BrioHR payroll export (TSV or CSV). Required: name or ic_number, plus basic/ot/gross/epf/socso/eis/pcb/net.
                </p>
              </div>
              <button onClick={() => setCompareRunId(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={compareInput}
              onChange={(e) => setCompareInput(e.target.value)}
              placeholder={`name\tic_number\tbasic\tot\tgross\tepf\tsocso\teis\tpcb\tnet\nAli Bin Abu\t900101-10-1234\t2200\t0\t2200\t242\t11\t4.4\t0\t1942.60\n...`}
              className="w-full min-h-[200px] rounded-lg border bg-background p-3 text-xs font-mono"
            />

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={handleCompare}
                disabled={comparing || !compareInput.trim()}
                className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-50"
              >
                {comparing && <Loader2 className="h-4 w-4 animate-spin" />}
                Run Compare
              </button>
              {compareResult && (
                <div className="text-sm">
                  <span className="font-semibold">{compareResult.summary.matched}</span>/{compareResult.summary.rows_compared} matched
                  {compareResult.summary.with_mismatches > 0 && (
                    <span className="ml-3 font-semibold text-red-600">{compareResult.summary.with_mismatches} with mismatches</span>
                  )}
                </div>
              )}
            </div>

            {compareResult && (
              <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto">
                {compareResult.results.map((r, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${r.matched && (r.mismatches ?? 0) > 0 ? "border-red-300 bg-red-50" : r.matched ? "border-green-200 bg-green-50/30" : "border-amber-300 bg-amber-50"}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.name}</span>
                      {r.matched ? (
                        (r.mismatches ?? 0) === 0
                          ? <span className="text-green-700">✓ all match</span>
                          : <span className="text-red-700">{r.mismatches} mismatch{(r.mismatches ?? 0) > 1 ? "es" : ""}</span>
                      ) : (
                        <span className="text-amber-700">{r.note}</span>
                      )}
                    </div>
                    {r.comparisons && (
                      <table className="mt-2 w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pb-1">Field</th>
                            <th className="pb-1 text-right">Ours</th>
                            <th className="pb-1 text-right">BrioHR</th>
                            <th className="pb-1 text-right">Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.comparisons.filter((c) => c.status !== "skipped").map((c, j) => (
                            <tr key={j}>
                              <td className="py-0.5 font-mono text-[10px]">{c.field}</td>
                              <td className="py-0.5 text-right font-mono">{fmt(c.ours)}</td>
                              <td className="py-0.5 text-right font-mono">{c.theirs !== undefined && c.theirs !== null ? fmt(c.theirs) : "—"}</td>
                              <td className={`py-0.5 text-right font-mono ${c.status === "mismatch" ? "font-bold text-red-600" : c.status === "near" ? "text-amber-600" : "text-muted-foreground"}`}>
                                {c.diff !== null ? fmt(c.diff) : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
