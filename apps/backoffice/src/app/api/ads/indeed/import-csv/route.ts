import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importIndeedCsv, type CsvImportResult } from "@/lib/indeed/import-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ads/indeed/import-csv
// multipart/form-data:
//   files: one or more CSVs (Indeed itemized invoice and/or analytics export)
//   periodStart, periodEnd: only required when ANY of the files is an
//     analytics CSV (itemized invoices encode their own dates).
//
// Returns per-file results so the UI can show what was imported from each.
export async function POST(req: NextRequest) {
  try {
    await requireRole(req.headers, "ADMIN", "OWNER");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  // Accept "files" (multi) and legacy "file" (single).
  const filesEntries = [...form.getAll("files"), ...form.getAll("file")];
  const files = filesEntries.filter((v): v is File => v instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "At least one CSV file required" }, { status: 400 });

  const periodStartStr = form.get("periodStart");
  const periodEndStr   = form.get("periodEnd");
  const periodStart = typeof periodStartStr === "string" && periodStartStr ? new Date(periodStartStr) : undefined;
  const periodEnd   = typeof periodEndStr   === "string" && periodEndStr   ? new Date(periodEndStr)   : undefined;

  const log = await prisma.indeedAdsSyncLog.create({
    data: { kind: "csv-import", status: "running" },
  });

  const perFile: Array<{ fileName: string } & CsvImportResult> = [];
  let totalJobs = 0, totalMetrics = 0, totalInvoices = 0;
  const errors: string[] = [];

  try {
    for (const file of files) {
      const csvText = await file.text();
      const result = await importIndeedCsv({ csvText, periodStart, periodEnd });
      perFile.push({ fileName: file.name, ...result });
      totalJobs     += result.jobsUpserted;
      totalMetrics  += result.metricsUpserted;
      totalInvoices += result.invoicesUpserted;
      for (const err of result.errors) errors.push(`${file.name}: ${err}`);
    }

    await prisma.indeedAdsSyncLog.update({
      where: { id: log.id },
      data:  {
        status:       "ok",
        finishedAt:   new Date(),
        rowsUpserted: totalJobs + totalMetrics + totalInvoices,
        errorMessage: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      },
    });

    return NextResponse.json({
      ok: true,
      jobsUpserted:     totalJobs,
      metricsUpserted:  totalMetrics,
      invoicesUpserted: totalInvoices,
      files:            perFile,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.indeedAdsSyncLog.update({
      where: { id: log.id },
      data:  { status: "error", finishedAt: new Date(), errorMessage: msg },
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
