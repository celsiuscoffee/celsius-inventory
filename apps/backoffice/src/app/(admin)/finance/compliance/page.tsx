"use client";

// Compliance — three sections in one page:
//   1. SST-02 (bi-monthly tax filing prep + mark filed)
//   2. MyInvois e-invoice (consolidated B2C submission status)
//   3. Period close (run depreciation + lock month)

import { useState } from "react";
import { useFetch } from "@/lib/use-fetch";
import { Button, Badge } from "@celsius/ui";
import {
  Loader2,
  ShieldCheck,
  ReceiptText,
  CalendarDays,
  Lock,
  Unlock,
  Send,
  CheckCircle2,
  XCircle,
  Wand2,
} from "lucide-react";

const RM = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

function thisMonth(): string {
  const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 7);
}

function lastMonth(): string {
  const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  myt.setUTCMonth(myt.getUTCMonth() - 1);
  return myt.toISOString().slice(0, 7);
}

// ─── SST-02 section ─────────────────────────────────────────────

type SstFiling = {
  id: string;
  period: string;
  output_tax: number;
  input_tax: number;
  net_payable: number;
  filing_status: "draft" | "filed" | "paid";
  filed_at: string | null;
  payment_ref: string | null;
};

function SstSection() {
  const { data, error, isLoading, mutate } = useFetch<{ filings: SstFiling[] }>("/api/finance/sst");
  const [yearMonth, setYearMonth] = useState(thisMonth());
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function calculate() {
    setBusy(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/finance/sst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth }),
      });
      const j = await res.json();
      if (!res.ok) setErrMsg(j.error ?? `Failed (${res.status})`);
      else mutate();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function markFiled(period: string) {
    const ref = window.prompt(`Payment reference for ${period}?`);
    if (!ref) return;
    const res = await fetch("/api/finance/sst/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, paymentRef: ref }),
    });
    if (res.ok) mutate();
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ReceiptText className="h-4 w-4 shrink-0" />
          <span className="font-medium">SST-02</span>
          <span className="hidden sm:inline text-xs text-muted-foreground truncate">
            bi-monthly tax filing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
          <Button onClick={calculate} disabled={busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Calculate
          </Button>
        </div>
      </header>
      {errMsg && <div className="px-4 py-2 text-sm text-destructive">{errMsg}</div>}
      {isLoading && <div className="px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      {error && <div className="px-4 py-3 text-sm text-destructive">Failed to load.</div>}
      {data && data.filings.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No SST drafts yet. Pick a month and click Calculate.
        </div>
      )}
      {data && data.filings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Period</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">Output</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">Input</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">Net payable</th>
                <th className="whitespace-nowrap px-3 py-2">Status</th>
                <th className="whitespace-nowrap px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.filings.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{f.period}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{RM(Number(f.output_tax))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{RM(Number(f.input_tax))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">
                    {RM(Number(f.net_payable))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant={f.filing_status === "filed" ? "default" : "outline"}>
                      {f.filing_status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {f.filing_status === "draft" ? (
                      <Button onClick={() => markFiled(f.period)} variant="outline" size="xs">
                        Mark filed
                      </Button>
                    ) : (
                      <span className="truncate text-xs text-muted-foreground">{f.payment_ref}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── e-Invoice section ──────────────────────────────────────────

type EinvoiceRow = {
  id: string;
  invoice_id: string;
  myinvois_uuid: string | null;
  submission_id: string | null;
  status: string;
  submitted_at: string | null;
  validated_at: string | null;
  validation_results: unknown;
  qr_url: string | null;
  created_at: string;
};

function EinvoiceSection() {
  const { data, isLoading, mutate } = useFetch<{ submissions: EinvoiceRow[]; enabled: boolean }>(
    "/api/finance/einvoice"
  );
  const [yearMonth, setYearMonth] = useState(lastMonth());
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submitMonth() {
    setBusy(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/finance/einvoice/consolidated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth }),
      });
      const j = await res.json();
      if (!res.ok) setErrMsg(j.error ?? `Failed (${res.status})`);
      else mutate();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span className="font-medium">MyInvois e-invoice</span>
          {data && (
            <Badge variant={data.enabled ? "default" : "outline"}>
              {data.enabled ? "configured" : "not configured"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
          <Button onClick={submitMonth} disabled={busy || !data?.enabled} size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit consolidated
          </Button>
        </div>
      </header>

      {!data?.enabled && (
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          MyInvois sandbox/prod not configured. Set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">MYINVOIS_ENV</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">MYINVOIS_CLIENT_ID</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">MYINVOIS_CLIENT_SECRET</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">MYINVOIS_TIN</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">MYINVOIS_BRN</code> in Vercel env to enable.
        </div>
      )}

      {errMsg && <div className="px-4 py-2 text-sm text-destructive">{errMsg}</div>}
      {isLoading && <div className="px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      {data && data.submissions.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No submissions yet.
        </div>
      )}
      {data && data.submissions.length > 0 && (
        <div className="max-h-96 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Submitted</th>
                <th className="whitespace-nowrap px-3 py-2">UUID</th>
                <th className="whitespace-nowrap px-3 py-2">Status</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleString("en-MY") : "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs">
                    {s.myinvois_uuid ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {s.status === "valid" || s.status === "submitted" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> {s.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                        <XCircle className="h-3 w-3" /> {s.status}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-xs text-muted-foreground">
                    {Array.isArray(s.validation_results) && s.validation_results.length > 0
                      ? JSON.stringify(s.validation_results)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Period close section ───────────────────────────────────────

type Period = {
  period: string;
  status: "open" | "closing" | "closed";
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  pnl_snapshot: { netIncome?: number } | null;
};

function PeriodSection() {
  const { data, isLoading, mutate } = useFetch<{ periods: Period[] }>("/api/finance/periods");
  const [period, setPeriod] = useState(lastMonth());
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function close(lock: boolean) {
    setBusy(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/finance/periods/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, lock }),
      });
      const j = await res.json();
      if (!res.ok) setErrMsg(j.error ?? `Failed (${res.status})`);
      else mutate();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function reopen(p: string) {
    const reason = window.prompt(`Reopen ${p}? Reason (audited):`);
    if (!reason || reason.length < 5) return;
    const res = await fetch("/api/finance/periods/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: p, reason }),
    });
    if (res.ok) mutate();
    else {
      const j = await res.json();
      setErrMsg(j.error ?? "Reopen failed");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="font-medium">Period close</span>
          <span className="hidden sm:inline text-xs text-muted-foreground truncate">
            depreciation + snapshot, optionally lock
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          />
          <Button onClick={() => close(false)} disabled={busy} variant="outline" size="sm">
            Run snapshot
          </Button>
          <Button onClick={() => close(true)} disabled={busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Close & lock
          </Button>
        </div>
      </header>

      {errMsg && <div className="px-4 py-2 text-sm text-destructive">{errMsg}</div>}
      {isLoading && <div className="px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}

      {data && data.periods.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No closed periods yet.
        </div>
      )}
      {data && data.periods.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Period</th>
                <th className="whitespace-nowrap px-3 py-2">Status</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">Net income</th>
                <th className="whitespace-nowrap px-3 py-2">Closed</th>
                <th className="whitespace-nowrap px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.period} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{p.period}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {p.status === "closed" ? (
                        <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Unlock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      )}
                      <Badge variant={p.status === "closed" ? "default" : "outline"}>
                        {p.status}
                      </Badge>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {p.pnl_snapshot?.netIncome !== undefined ? RM(p.pnl_snapshot.netIncome) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {p.closed_at ? new Date(p.closed_at).toLocaleDateString("en-MY") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {p.status === "closed" && (
                      <Button onClick={() => reopen(p.period)} variant="outline" size="xs">
                        Reopen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function FinanceCompliancePage() {
  return (
    <div className="space-y-6 p-3 sm:p-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Compliance</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
          SST-02 filing prep, MyInvois e-invoice, and period close.
        </p>
      </header>

      <SstSection />
      <EinvoiceSection />
      <PeriodSection />
    </div>
  );
}
