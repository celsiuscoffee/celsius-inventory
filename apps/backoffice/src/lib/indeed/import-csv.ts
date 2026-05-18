/**
 * Parse Indeed CSV exports and upsert into our DB.
 *
 * Auto-detects between two real Indeed export shapes:
 *
 * 1. ITEMIZED INVOICE
 *    File pattern: Indeed_itemized_report_SGI26-XXXXXXXX.csv
 *    Line 1: "Itemized report for invoice #<invoice-number>"
 *    Line 4: "Itemization details <Mon DD, YYYY>"
 *    Line 6: header (Company, Job Key, Reference Number, Job Title,
 *            Location, Quantity, Unit, Average Cost, Total, Currency)
 *    Line 7+: data rows
 *    Trailing rows: subtotal / Service Tax / grand total (empty Job Key)
 *
 *    → Writes one IndeedAdsInvoice (with grand total)
 *      + upserts each itemized job (IndeedAdsJob)
 *      + IndeedAdsMetricDaily at invoice issue date (clicks + spend)
 *
 * 2. ANALYTICS (Jobs and campaigns report)
 *    File pattern: JobsCampaigns_YYYYMMDD_YYYYMMDD.csv
 *    Line 1: header (Job, Premium, Campaigns, Country, State/Region,
 *            City, Reference #, ..., Impressions, Clicks, Apply starts,
 *            Applies, Spend, ...)
 *    Line 2+: data rows
 *
 *    → Upserts IndeedAdsJob + IndeedAdsMetricDaily at user-provided
 *      periodEnd date with full impressions/clicks/applies breakdown.
 *
 * Cross-format de-dup: both shapes carry the same UUID-style "Reference
 * #" / "Reference Number" identifying a job. We use that as the stable
 * indeedJobId so the same job upserts cleanly across an analytics import
 * and any number of itemized invoice imports.
 */

import { prisma } from "@/lib/prisma";
import { resolveOutletId } from "./outlet-map";

export type CsvImportResult = {
  format:          "itemized-invoice" | "analytics" | "unknown";
  rowsParsed:      number;
  jobsUpserted:    number;
  metricsUpserted: number;
  invoicesUpserted: number;
  invoiceNumber?:  string | null;
  errors:          string[];
};

export type CsvImportContext = {
  csvText:     string;
  /** Required only for analytics imports. Ignored for itemized invoices
   *  (they encode their own issue date in the file). */
  periodStart?: Date;
  periodEnd?:   Date;
};

export async function importIndeedCsv(ctx: CsvImportContext): Promise<CsvImportResult> {
  const rows = parseCsv(ctx.csvText);
  if (rows.length === 0) {
    return emptyResult("unknown", ["CSV has no rows"]);
  }

  const format = detectFormat(rows);
  if (format === "itemized-invoice") return importItemizedInvoice(rows);
  if (format === "analytics")        return importAnalytics(rows, ctx);
  return emptyResult("unknown", [
    "Unrecognised CSV format. Expected an Indeed 'Itemized report for invoice' or 'Jobs and campaigns' export.",
  ]);
}

function detectFormat(rows: string[][]): "itemized-invoice" | "analytics" | "unknown" {
  const first = (rows[0]?.[0] ?? "").toLowerCase();
  if (first.includes("itemized report for invoice")) return "itemized-invoice";

  // Analytics CSVs start with a header row containing Job + Spend columns.
  const headers = rows[0]?.map(h => h.trim().toLowerCase()) ?? [];
  if (headers.includes("job") && headers.includes("spend")) return "analytics";
  return "unknown";
}

// ─── Itemized invoice ─────────────────────────────────────────────────

async function importItemizedInvoice(rows: string[][]): Promise<CsvImportResult> {
  const errors: string[] = [];

  const invMatch = rows[0]?.[0]?.match(/invoice\s+#?(\S+)/i);
  const invoiceNumber = invMatch ? invMatch[1].replace(/[^A-Za-z0-9-]/g, "") : null;

  // "Itemization details Apr 30, 2026" — pull the date phrase
  const dateLine = rows[3]?.[0] ?? "";
  const dateMatch = dateLine.match(/([A-Za-z]+\s+\d+,\s*\d{4})/);
  const issueDate = dateMatch ? new Date(dateMatch[1]) : new Date();
  if (Number.isNaN(issueDate.getTime())) {
    return emptyResult("itemized-invoice", [`Could not parse invoice date from "${dateLine}"`]);
  }

  // Header lives on line 6 (index 5); data starts on line 7 (index 6).
  const headerRowIdx = findHeaderRow(rows, ["job key", "job title", "total"]);
  if (headerRowIdx < 0) {
    return emptyResult("itemized-invoice", ["Could not find data header row (looking for Job Key + Job Title + Total)"]);
  }
  const header = rows[headerRowIdx].map(h => h.trim().toLowerCase());
  const colJobKey = header.indexOf("job key");
  const colRefNum = header.indexOf("reference number");
  const colTitle  = header.indexOf("job title");
  const colLoc    = header.indexOf("location");
  const colQty    = header.indexOf("quantity");
  const colTotal  = header.indexOf("total");

  let grandTotalUsd = 0;
  const jobRows: string[][] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => (c ?? "") === "")) continue;
    // Trailing summary rows have empty first column with a label in the second-to-last cell.
    if ((row[0] ?? "") === "" && colTotal >= 0) {
      const label = (row[colTotal - 1] ?? "").toLowerCase();
      if (/total amount/.test(label)) {
        grandTotalUsd = parseMoney(row[colTotal]);
      }
      // Skip subtotal / Service Tax / Total amount rows.
      continue;
    }
    jobRows.push(row);
  }

  // Period: issue month start → issue date. Bills usually cover the month
  // leading up to issue date.
  const periodStart = new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
  const periodEnd   = issueDate;

  // Upsert the invoice itself.
  let invoiceCreated = 0;
  if (invoiceNumber) {
    await prisma.indeedAdsInvoice.upsert({
      where:  { invoiceNumber },
      create: { invoiceNumber, issueDate, periodStart, periodEnd, amountUsd: grandTotalUsd.toFixed(2), status: "unpaid" },
      update: { issueDate, periodStart, periodEnd, amountUsd: grandTotalUsd.toFixed(2) },
    });
    invoiceCreated = 1;
  } else {
    errors.push("Invoice number missing from line 1 — skipping IndeedAdsInvoice record");
  }

  let jobsUpserted = 0;
  let metricsUpserted = 0;

  for (let i = 0; i < jobRows.length; i++) {
    const row = jobRows[i];
    const refId  = colRefNum >= 0 ? (row[colRefNum] ?? "").trim() : "";
    const jobKey = colJobKey >= 0 ? (row[colJobKey] ?? "").trim() : "";
    const indeedJobId = refId || jobKey;
    if (!indeedJobId) { errors.push(`Row ${i + headerRowIdx + 2}: no Reference Number or Job Key`); continue; }

    const title = (row[colTitle] ?? "").trim() || "(untitled)";
    const locationRaw = (row[colLoc] ?? "").trim();
    const city = locationRaw || null;
    const outletId = await resolveOutletId(city);
    const clicks = parseIntSafe(row[colQty]);
    const spend  = parseMoney(row[colTotal]);

    try {
      const job = await prisma.indeedAdsJob.upsert({
        where:  { indeedJobId },
        create: {
          indeedJobId,
          title,
          locationCity:  city,
          locationState: null,
          outletId,
          status:        "OPEN",
          premium:       false,
        },
        update: {
          title,
          locationCity:  city,
          lastSyncedAt:  new Date(),
        },
      });
      jobsUpserted++;

      await prisma.indeedAdsMetricDaily.upsert({
        where:  { date_jobId: { date: issueDate, jobId: job.id } },
        create: {
          date:        issueDate,
          jobId:       job.id,
          clicks:      BigInt(clicks),
          spendUsd:    spend.toFixed(2),
          costPerClick: clicks > 0 ? +(spend / clicks).toFixed(4) : null,
        },
        update: {
          // Don't overwrite analytics-imported impressions/applies for the
          // same date — only touch the fields the invoice CSV actually
          // provides (clicks + spend).
          clicks:      BigInt(clicks),
          spendUsd:    spend.toFixed(2),
          costPerClick: clicks > 0 ? +(spend / clicks).toFixed(4) : null,
          syncedAt:    new Date(),
        },
      });
      metricsUpserted++;
    } catch (err) {
      errors.push(`Row ${i + headerRowIdx + 2}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    format: "itemized-invoice",
    rowsParsed: jobRows.length,
    jobsUpserted,
    metricsUpserted,
    invoicesUpserted: invoiceCreated,
    invoiceNumber,
    errors,
  };
}

// ─── Analytics (Jobs and campaigns report) ────────────────────────────

async function importAnalytics(rows: string[][], ctx: CsvImportContext): Promise<CsvImportResult> {
  const errors: string[] = [];
  if (!ctx.periodEnd) {
    return emptyResult("analytics", ["periodEnd is required for analytics CSV imports"]);
  }
  const periodEnd = ctx.periodEnd;

  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = (...names: string[]): number => {
    for (const name of names) { const i = header.indexOf(name.toLowerCase()); if (i !== -1) return i; }
    return -1;
  };

  const colTitle    = idx("job", "job title", "title", "posting");
  const colSpend    = idx("spend", "cost", "amount");
  const colCity     = idx("city", "location", "job location");
  const colState    = idx("state/region", "state", "region");
  const colCampaign = idx("campaigns", "campaign", "campaign name");
  const colJobId    = idx("reference #", "reference number", "job id", "job key", "jobkey", "id");
  const colPremium  = idx("premium");
  const colImp      = idx("impressions");
  const colClicks   = idx("clicks");
  const colApplyStarts = idx("apply starts", "applystarts");
  const colApplies  = idx("applies");
  const colStatus   = idx("job status", "status");

  if (colTitle === -1)  return emptyResult("analytics", [`Required column "Job" / "Job title" not found. Got: ${header.join(", ")}`]);
  if (colSpend === -1)  return emptyResult("analytics", [`Required column "Spend" not found. Got: ${header.join(", ")}`]);

  let jobsUpserted = 0;
  let metricsUpserted = 0;
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.every(c => (c ?? "").trim() === "")) continue;
    const title = (row[colTitle] ?? "").trim();
    if (!title || /^total/i.test(title)) continue;

    const city  = colCity  >= 0 ? ((row[colCity]  ?? "").trim() || null) : null;
    const state = colState >= 0 ? ((row[colState] ?? "").trim() || null) : null;
    const outletId = await resolveOutletId(city);
    const indeedJobId = colJobId >= 0 && (row[colJobId] ?? "").trim()
      ? (row[colJobId] ?? "").trim()
      : stableHash(title, city ?? "");

    const spend = parseMoney(row[colSpend]);
    const impressions = colImp     >= 0 ? parseIntSafe(row[colImp])    : 0;
    const clicks      = colClicks  >= 0 ? parseIntSafe(row[colClicks]) : 0;
    const applyStarts = colApplyStarts >= 0 ? parseIntSafe(row[colApplyStarts]) : 0;
    const applies     = colApplies >= 0 ? parseIntSafe(row[colApplies]) : 0;
    const status      = colStatus  >= 0 ? ((row[colStatus] ?? "").trim() || null) : null;
    const premium     = colPremium >= 0 ? /yes|true/i.test(row[colPremium] ?? "") : false;
    const campaign    = colCampaign >= 0 ? ((row[colCampaign] ?? "").trim() || null) : null;

    try {
      const job = await prisma.indeedAdsJob.upsert({
        where:  { indeedJobId },
        create: {
          indeedJobId,
          campaignName:  campaign,
          title,
          locationCity:  city,
          locationState: state,
          outletId,
          status:        status ?? "OPEN",
          premium,
        },
        update: {
          campaignName:  campaign,
          title,
          locationCity:  city,
          locationState: state,
          status:        status ?? undefined,
          premium,
          lastSyncedAt:  new Date(),
        },
      });
      jobsUpserted++;

      await prisma.indeedAdsMetricDaily.upsert({
        where:  { date_jobId: { date: periodEnd, jobId: job.id } },
        create: {
          date: periodEnd,
          jobId: job.id,
          impressions: BigInt(impressions),
          clicks:      BigInt(clicks),
          applyStarts: BigInt(applyStarts),
          applies:     BigInt(applies),
          spendUsd:    spend.toFixed(2),
          costPerClick: clicks  > 0 ? +(spend / clicks ).toFixed(4) : null,
          costPerApply: applies > 0 ? +(spend / applies).toFixed(4) : null,
        },
        update: {
          impressions: BigInt(impressions),
          clicks:      BigInt(clicks),
          applyStarts: BigInt(applyStarts),
          applies:     BigInt(applies),
          spendUsd:    spend.toFixed(2),
          costPerClick: clicks  > 0 ? +(spend / clicks ).toFixed(4) : null,
          costPerApply: applies > 0 ? +(spend / applies).toFixed(4) : null,
          syncedAt:    new Date(),
        },
      });
      metricsUpserted++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    format: "analytics",
    rowsParsed: dataRows.length,
    jobsUpserted,
    metricsUpserted,
    invoicesUpserted: 0,
    errors,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function emptyResult(format: CsvImportResult["format"], errors: string[]): CsvImportResult {
  return { format, rowsParsed: 0, jobsUpserted: 0, metricsUpserted: 0, invoicesUpserted: 0, errors };
}

function findHeaderRow(rows: string[][], requiredCols: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const lower = rows[i].map(c => c.trim().toLowerCase());
    if (requiredCols.every(c => lower.includes(c))) return i;
  }
  return -1;
}

function parseMoney(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(s: string | undefined): number {
  if (!s) return 0;
  const n = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

import { createHash } from "crypto";
function stableHash(title: string, city: string): string {
  return "csv-" + createHash("sha1").update(`${title}|${city}`).digest("hex").slice(0, 24);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuote = false;
      else field += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",")  { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip — handled by \n */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
