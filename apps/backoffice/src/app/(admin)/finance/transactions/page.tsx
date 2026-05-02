"use client";

// Universal ledger view. Lists posted journals from fin_transactions with
// filters and a Sheet drawer showing the journal lines + source document.

import { useState, useMemo } from "react";
import { useFetch } from "@/lib/use-fetch";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, Badge } from "@celsius/ui";
import { Loader2, FileText, Bot, User as UserIcon } from "lucide-react";

type Outlet = { id: string; name: string; code: string };

type Transaction = {
  id: string;
  txn_date: string;
  description: string;
  outlet_id: string | null;
  amount: number;
  currency: string;
  txn_type: string;
  posted_by_agent: string | null;
  agent_version: string | null;
  confidence: number | null;
  status: "draft" | "posted" | "exception" | "reversed";
  posted_at: string | null;
  period: string;
  source_doc_id: string | null;
  outlet: Outlet | null;
};

type JournalLine = {
  id: string;
  account_code: string;
  account_name: string | null;
  outlet_id: string | null;
  debit: number;
  credit: number;
  memo: string | null;
  line_order: number;
};

type SourceDoc = {
  id: string;
  source: string;
  source_ref: string;
  doc_type: string;
  raw_url: string | null;
  received_at: string;
};

const RM = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const variant: Record<Transaction["status"], "default" | "secondary" | "destructive" | "outline"> = {
    posted: "default",
    draft: "outline",
    exception: "destructive",
    reversed: "secondary",
  };
  return <Badge variant={variant[status]}>{status}</Badge>;
}

function DrawerContent({ id }: { id: string }) {
  const { data, error } = useFetch<{
    transaction: Transaction;
    lines: JournalLine[];
    document: SourceDoc | null;
  }>(`/api/finance/transactions/${id}`);

  if (!data && !error) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-destructive">Failed to load.</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-5 overflow-y-auto p-6">
      <section className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
        <div className="break-words">{data.transaction.description}</div>
      </section>

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Date</div>
          <div className="tabular-nums">{data.transaction.txn_date}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
          <StatusBadge status={data.transaction.status} />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount</div>
          <div className="truncate font-medium tabular-nums">{RM(Number(data.transaction.amount))}</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Posted by</div>
          <div className="flex items-center gap-1 truncate">
            {data.transaction.posted_by_agent === "manual" ? (
              <UserIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Bot className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{data.transaction.posted_by_agent ?? "—"}</span>
            {data.transaction.confidence !== null && (
              <span className="shrink-0 text-muted-foreground">
                ({Math.round(Number(data.transaction.confidence) * 100)}%)
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Journal lines
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Account</th>
                <th className="px-2 py-1.5 text-right">Debit</th>
                <th className="px-2 py-1.5 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="min-w-0 px-2 py-1.5">
                    <div className="font-medium tabular-nums">{l.account_code}</div>
                    {l.account_name && (
                      <div className="text-xs text-muted-foreground">{l.account_name}</div>
                    )}
                    {l.memo && (
                      <div className="break-words text-xs text-muted-foreground">{l.memo}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {Number(l.debit) ? RM(Number(l.debit)) : ""}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {Number(l.credit) ? RM(Number(l.credit)) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.document && (
        <section className="rounded-md border bg-muted/20 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Source document
          </div>
          <div className="truncate">
            {data.document.source} · {data.document.doc_type}
          </div>
          <div className="break-all text-xs text-muted-foreground">{data.document.source_ref}</div>
        </section>
      )}
    </div>
  );
}

export default function FinanceTransactionsPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const qs = useMemo(() => (statusFilter ? `?status=${statusFilter}` : ""), [statusFilter]);
  const { data, error, isLoading } = useFetch<{ transactions: Transaction[] }>(
    `/api/finance/transactions${qs}`
  );

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">Transactions</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Every journal posted to the ledger by agents and humans.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm shrink-0"
        >
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="draft">Draft</option>
          <option value="exception">Exception</option>
          <option value="reversed">Reversed</option>
        </select>
      </header>

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Failed to load: {String(error)}
        </div>
      )}

      {data && data.transactions.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No transactions yet. Run the StoreHub EOD ingest to backfill.
        </div>
      )}

      {data && data.transactions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="whitespace-nowrap px-3 py-2 hidden md:table-cell">Outlet</th>
                <th className="whitespace-nowrap px-3 py-2 hidden lg:table-cell">Type</th>
                <th className="whitespace-nowrap px-3 py-2 hidden lg:table-cell">Agent</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">Amount</th>
                <th className="whitespace-nowrap px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-t transition hover:bg-muted/30"
                  onClick={() => setOpenId(t.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{t.txn_date}</td>
                  <td className="max-w-[280px] truncate px-3 py-2">{t.description}</td>
                  <td className="whitespace-nowrap px-3 py-2 hidden md:table-cell">
                    {t.outlet?.name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">
                    {t.txn_type}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 hidden lg:table-cell text-xs">
                    {t.posted_by_agent}
                    {t.confidence !== null && (
                      <span className="ml-1 text-muted-foreground">
                        ({Math.round(Number(t.confidence) * 100)}%)
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {RM(Number(t.amount))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-hidden flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Transaction</SheetTitle>
          </SheetHeader>
          {openId && <DrawerContent id={openId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
