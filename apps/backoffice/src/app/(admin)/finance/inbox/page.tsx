"use client";

// Exception inbox — list of items the agents couldn't auto-resolve, plus a
// drop zone for uploading supplier bills. The Sheet drawer shows the source
// doc preview alongside the agent's proposal and the action buttons.

import { useState, useRef, useMemo } from "react";
import { useFetch } from "@/lib/use-fetch";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Badge,
} from "@celsius/ui";
import {
  Loader2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileText,
  Bot,
} from "lucide-react";

type ExceptionRow = {
  id: string;
  type: string;
  related_type: string;
  related_id: string;
  agent: string;
  reason: string;
  proposed_action: ProposedAction | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

type ProposedAction = {
  supplierId?: string;
  supplierName?: string;
  outletId?: string | null;
  categorize?: { accountCode: string | null; confidence: number; reasoning: string; alternativeCodes?: string[] };
  bill?: {
    supplierName: string | null;
    billNumber: string | null;
    billDate: string | null;
    dueDate: string | null;
    subtotal: number | null;
    sst: number | null;
    total: number | null;
    notes: string | null;
    rawWarnings?: string[];
  };
  duplicateOfBillId?: string;
};

type Account = {
  code: string;
  name: string;
  type: string;
};

type ExceptionDetail = {
  exception: ExceptionRow;
  document: {
    id: string;
    source: string;
    source_ref: string;
    doc_type: string;
    raw_url: string | null;
    signed_url: string | null;
    metadata: { uploadedById?: string; mimeType?: string } | null;
    received_at: string;
  } | null;
};

const RM = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);

function PriorityBadge({ priority }: { priority: ExceptionRow["priority"] }) {
  const variant: Record<ExceptionRow["priority"], "default" | "secondary" | "destructive" | "outline"> = {
    urgent: "destructive",
    high: "destructive",
    normal: "secondary",
    low: "outline",
  };
  return <Badge variant={variant[priority]}>{priority}</Badge>;
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setLast(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/finance/bills/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setLast(`Failed: ${data.error ?? res.status}`);
      } else if (data.result?.kind === "posted") {
        setLast(`Posted RM ${data.result.total.toFixed(2)} — ${file.name}`);
      } else if (data.result?.kind === "exception") {
        setLast(`Queued for review — ${file.name}`);
      }
      onUploaded();
    } catch (err) {
      setLast(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Upload supplier bill</div>
          <div className="text-xs text-muted-foreground">
            PDF, JPEG, or PNG. AP agent extracts + categorizes automatically.
          </div>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          size="sm"
          className="shrink-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {last && <div className="mt-2 truncate text-xs text-muted-foreground">{last}</div>}
    </div>
  );
}

function DrawerBody({
  id,
  onResolved,
  onClose,
  accounts,
}: {
  id: string;
  onResolved: () => void;
  onClose: () => void;
  accounts: Account[];
}) {
  const { data, error, mutate } = useFetch<ExceptionDetail>(`/api/finance/exceptions/${id}`);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const proposal = data?.exception.proposed_action ?? null;
  const proposedCode = proposal?.categorize?.accountCode ?? null;

  async function act(action: "approve" | "dismiss" | "correct") {
    setBusy(true);
    setErrMsg(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "correct") {
        if (!override) {
          setErrMsg("Pick an account code first");
          setBusy(false);
          return;
        }
        body.accountCode = override;
      }
      if (action === "dismiss") body.reason = "dismissed via inbox";
      const res = await fetch(`/api/finance/exceptions/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setErrMsg(j.error ?? `Failed (${res.status})`);
      } else if (j.result?.kind === "noop") {
        setErrMsg(j.result.reason);
      } else {
        await mutate();
        onResolved();
        onClose();
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (error) return <div className="p-6 text-sm text-destructive">Failed to load.</div>;
  if (!data) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-5 overflow-y-auto p-6">
        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Reason</div>
          <div className="mt-1 break-words text-sm">{data.exception.reason}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Bot className="h-3 w-3 shrink-0" />
            <span className="truncate">{data.exception.agent} · {data.exception.type}</span>
          </div>
        </section>

        {proposal?.bill && (
          <section className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Parsed bill
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="break-words">{proposal.supplierName ?? proposal.bill.supplierName ?? "—"}</dd>
              <dt className="text-muted-foreground">Bill #</dt>
              <dd className="break-all">{proposal.bill.billNumber ?? "—"}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="tabular-nums">{proposal.bill.billDate ?? "—"}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="tabular-nums">{proposal.bill.dueDate ?? "—"}</dd>
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{RM(proposal.bill.subtotal)}</dd>
              <dt className="text-muted-foreground">SST</dt>
              <dd className="tabular-nums">{RM(proposal.bill.sst)}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="tabular-nums font-medium">{RM(proposal.bill.total)}</dd>
            </dl>
            {proposal.bill.rawWarnings && proposal.bill.rawWarnings.length > 0 && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="break-words">{proposal.bill.rawWarnings.join("; ")}</span>
              </div>
            )}
          </section>
        )}

        {proposal?.categorize && (
          <section className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Agent suggestion
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">{proposedCode ?? "—"}</Badge>
              <span className="text-xs text-muted-foreground">
                {Math.round(proposal.categorize.confidence * 100)}% confident
              </span>
            </div>
            <div className="mt-2 break-words text-xs text-muted-foreground">
              {proposal.categorize.reasoning}
            </div>
            {proposal.categorize.alternativeCodes && proposal.categorize.alternativeCodes.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Alternatives
                </div>
                <div className="flex flex-wrap gap-1">
                  {proposal.categorize.alternativeCodes.map((c) => (
                    <Button
                      key={c}
                      onClick={() => setOverride(c)}
                      variant={override === c ? "default" : "outline"}
                      size="xs"
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {data.document?.signed_url && (
          <section className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3 w-3" /> Source document
            </div>
            {data.document.metadata?.mimeType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.document.signed_url}
                alt="bill"
                className="max-h-96 w-full rounded border object-contain"
              />
            ) : (
              <a
                href={data.document.signed_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open PDF →
              </a>
            )}
          </section>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="space-y-3 border-t bg-card p-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Or pick a different account
          </label>
          <select
            value={override ?? ""}
            onChange={(e) => setOverride(e.target.value || null)}
            className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— keep agent suggestion —</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        {errMsg && <div className="text-xs text-destructive">{errMsg}</div>}
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() => act(override ? "correct" : "approve")}
            size="sm"
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4" />
            {override ? "Post with override" : "Approve & post"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => act("dismiss")}
            variant="outline"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FinanceInboxPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const exc = useFetch<{ exceptions: ExceptionRow[] }>("/api/finance/exceptions?status=open");
  const acc = useFetch<{ accounts: Account[] }>("/api/finance/accounts?types=expense,cogs,asset");

  const accountOptions = useMemo(() => acc.data?.accounts ?? [], [acc.data]);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold">Inbox</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
          Items the agents couldn&apos;t resolve. Approve, correct, or dismiss — every
          decision trains the categorizer.
        </p>
      </header>

      <UploadZone onUploaded={() => exc.mutate()} />

      {exc.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {exc.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Failed to load: {String(exc.error)}
        </div>
      )}

      {exc.data && exc.data.exceptions.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nothing in the inbox. The agents are caught up.
        </div>
      )}

      {exc.data && exc.data.exceptions.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Priority</th>
                <th className="px-3 py-2">Reason</th>
                <th className="whitespace-nowrap px-3 py-2 hidden md:table-cell">Supplier</th>
                <th className="whitespace-nowrap px-3 py-2 text-right hidden md:table-cell">Total</th>
                <th className="whitespace-nowrap px-3 py-2 hidden lg:table-cell">Agent</th>
                <th className="whitespace-nowrap px-3 py-2 hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {exc.data.exceptions.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer border-t transition hover:bg-muted/30"
                  onClick={() => setOpenId(e.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <PriorityBadge priority={e.priority} />
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2">{e.reason}</td>
                  <td className="whitespace-nowrap px-3 py-2 hidden md:table-cell max-w-[180px] truncate">
                    {e.proposed_action?.supplierName ?? e.proposed_action?.bill?.supplierName ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums hidden md:table-cell">
                    {RM(e.proposed_action?.bill?.total ?? null)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 hidden lg:table-cell text-xs">
                    {e.agent} · {e.type}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("en-MY")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Resolve exception</SheetTitle>
          </SheetHeader>
          {openId && (
            <DrawerBody
              id={openId}
              onResolved={() => exc.mutate()}
              onClose={() => setOpenId(null)}
              accounts={accountOptions}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
