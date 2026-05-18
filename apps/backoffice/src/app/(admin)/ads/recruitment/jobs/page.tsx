"use client";

import { useState } from "react";
import Link from "next/link";
import { useFetch } from "@/lib/use-fetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Loader2, BarChart3, Star, Upload, CheckCircle2, XCircle } from "lucide-react";

type JobRow = {
  id:            string;
  indeedJobId:   string;
  title:         string;
  campaignName:  string | null;
  locationCity:  string | null;
  locationState: string | null;
  status:        string | null;
  premium:       boolean;
  outletId:      string | null;
  outletName:    string | null;
  lastSyncedAt:  string;
  impressions:   number;
  clicks:        number;
  applyStarts:   number;
  applies:       number;
  spendUsd:      number;
};

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export default function RecruitmentJobsPage() {
  const { data, isLoading, mutate } = useFetch<{ jobs: JobRow[] }>("/api/ads/indeed/jobs");
  const [search, setSearch] = useState("");

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [importOpen, setImportOpen] = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [importToast, setImportToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd,   setPeriodEnd]   = useState(today);
  const [csvFiles,    setCsvFiles]    = useState<File[]>([]);

  async function submitImport(e: React.FormEvent) {
    e.preventDefault();
    if (csvFiles.length === 0) { setImportToast({ ok: false, msg: "Pick at least one CSV" }); return; }
    setImporting(true);
    setImportToast(null);
    try {
      const fd = new FormData();
      for (const f of csvFiles) fd.append("files", f);
      fd.append("periodStart", periodStart);
      fd.append("periodEnd",   periodEnd);
      const res = await fetch("/api/ads/indeed/import-csv", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setImportToast({ ok: false, msg: json.error ?? "Import failed" });
      } else {
        const parts: string[] = [];
        if (json.invoicesUpserted) parts.push(`${json.invoicesUpserted} invoice${json.invoicesUpserted === 1 ? "" : "s"}`);
        parts.push(`${json.jobsUpserted} postings`);
        parts.push(`${json.metricsUpserted} metric rows`);
        setImportToast({
          ok: true,
          msg: `Imported ${parts.join(", ")} from ${csvFiles.length} file${csvFiles.length === 1 ? "" : "s"}.${json.errors?.length ? ` ${json.errors.length} row error(s).` : ""}`,
        });
        mutate();
        setCsvFiles([]);
      }
    } catch (err) {
      setImportToast({ ok: false, msg: err instanceof Error ? err.message : "Network error" });
    } finally {
      setImporting(false);
    }
  }

  const jobs = data?.jobs ?? [];
  const filtered = search
    ? jobs.filter(j =>
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        (j.locationCity ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (j.campaignName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/ads/recruitment" className="hover:underline">Recruitment</Link>
            <span>/</span>
            <span>Postings</span>
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-terracotta" /> Sponsored Postings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Spend is from monthly CSV exports of the Indeed dashboard Analytics → Jobs report.
          </p>
        </div>
        <Button onClick={() => setImportOpen(v => !v)} className="gap-2">
          <Upload className="h-4 w-4" /> {importOpen ? "Cancel" : "Import CSV"}
        </Button>
      </div>

      {importOpen && (
        <Card className="p-4">
          <h2 className="text-sm font-medium mb-2">Import Indeed CSVs</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Two CSV formats are auto-detected: <b>Itemized invoice reports</b> (one per bill — populates Invoices + per-posting spend) and <b>Jobs and campaigns analytics</b> (populates per-posting impressions, clicks, applies, spend over a date range).
            Drop one or many at once. Period dates below are only used by the analytics format.
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Get them from <a href="https://employers.indeed.com/analytics/report-jobs-campaigns" target="_blank" rel="noopener noreferrer" className="text-terracotta hover:underline">Analytics</a> (View by Job → Export) or from individual bills on <a href="https://billing.indeed.com" target="_blank" rel="noopener noreferrer" className="text-terracotta hover:underline">billing.indeed.com</a>.
          </p>
          <form onSubmit={submitImport} className="space-y-3 text-sm">
            <FileDropzone
              label="CSV file(s)"
              accept=".csv,text/csv"
              multiple
              selected={csvFiles}
              onFiles={files => setCsvFiles(prev => [...prev, ...files])}
              onRemove={(_f, i) => setCsvFiles(prev => prev.filter((_, idx) => idx !== i))}
              hint="Indeed itemized invoice or Jobs and campaigns CSV (.csv) — drop multiple"
              disabled={importing}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <label>Analytics period start
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" />
              </label>
              <label>Analytics period end
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1 w-full border rounded px-2 py-1.5 bg-background" />
              </label>
              <Button type="submit" disabled={importing || csvFiles.length === 0} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />} Upload {csvFiles.length > 0 ? `(${csvFiles.length})` : ""}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {importToast && (
        <Card className={`flex items-center gap-2 p-3 text-sm ${
          importToast.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
        }`}>
          {importToast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {importToast.msg}
        </Card>
      )}

      <Card className="p-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, city, or campaign…"
          className="w-full border rounded px-3 py-2 text-sm bg-background"
        />
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No sponsored jobs found. Run a sync from <Link href="/ads/recruitment/settings" className="text-terracotta underline">Settings</Link>.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-normal">Title</th>
                <th className="px-4 py-2 text-left font-normal">Campaign</th>
                <th className="px-4 py-2 text-left font-normal">Location</th>
                <th className="px-4 py-2 text-left font-normal">Outlet</th>
                <th className="px-4 py-2 text-left font-normal">Status</th>
                <th className="px-4 py-2 text-right font-normal">Spend</th>
                <th className="px-4 py-2 text-right font-normal">Impressions</th>
                <th className="px-4 py-2 text-right font-normal">Clicks</th>
                <th className="px-4 py-2 text-right font-normal">Applies</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {j.premium && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      {j.title}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{j.campaignName ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {j.locationCity ? `${j.locationCity}${j.locationState ? `, ${j.locationState}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {j.outletName ?? <span className="text-amber-600">Unmapped</span>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`inline-flex rounded px-1.5 py-0.5 ${
                      j.status === "OPEN"   ? "bg-emerald-50 text-emerald-700"
                      : j.status === "PAUSED" ? "bg-amber-50 text-amber-700"
                      : "bg-neutral-100 text-neutral-700"
                    }`}>
                      {j.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{fmtUSD(j.spendUsd)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{fmtInt(j.impressions)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{fmtInt(j.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtInt(j.applies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
