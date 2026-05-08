// Background helper: when staff submits a receiving with invoice photos,
// run them through the backoffice's AI-extract endpoint and write the
// supplier-side fields straight onto the GRNI placeholder invoice. Marks
// the invoice as ai-prefilled so procurement sees a "verify before paying"
// banner — they don't have to retype anything, just confirm the AI got
// it right.
//
// Fire-and-forget: failures are logged, never blocked.

import { prisma } from "@/lib/prisma";

const BACKOFFICE_URL =
  process.env.BACKOFFICE_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_BACKOFFICE_URL ||
  "https://backoffice.celsiuscoffee.com";

type Extracted = {
  invoiceNumber: string | null;
  dueDate: string | null;
  issueDate: string | null;
  deliveryDate: string | null;
  amount: number | null;
  confidence: "high" | "medium" | "low";
};

export async function aiPrefillInvoice(invoiceId: string, photoUrls: string[]): Promise<void> {
  if (!photoUrls?.length) return;
  try {
    const res = await fetch(`${BACKOFFICE_URL}/api/inventory/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: photoUrls, context: "supplier_invoice" }),
      // The model can take 5-20s on multi-page PDFs.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[ai-prefill] extract failed:", res.status, await res.text().catch(() => ""));
      return;
    }
    const data = (await res.json()) as Extracted;

    // Skip if confidence is "low" or every useful field came back null —
    // not worth surfacing a prefill that procurement will just toss.
    const filled: string[] = [];
    const update: Record<string, unknown> = {};
    if (data.invoiceNumber) {
      update.invoiceNumber = data.invoiceNumber;
      filled.push("invoiceNumber");
    }
    if (data.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.issueDate)) {
      update.issueDate = new Date(data.issueDate + "T00:00:00.000Z");
      filled.push("issueDate");
    }
    if (data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
      update.dueDate = new Date(data.dueDate + "T00:00:00.000Z");
      filled.push("dueDate");
    }
    if (data.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(data.deliveryDate)) {
      update.deliveryDate = new Date(data.deliveryDate + "T00:00:00.000Z");
      filled.push("deliveryDate");
    }
    // Trust the AI on amount only when confidence is "high" AND it's positive
    // — supplier invoice should be the source of truth for the bill, not the
    // PO total which can drift via rounding/discrepancies.
    if (data.confidence === "high" && typeof data.amount === "number" && data.amount > 0) {
      update.amount = data.amount;
      filled.push("amount");
    }

    if (filled.length === 0) return;

    update.aiPrefilledAt = new Date();
    update.aiPrefilledFields = JSON.stringify(filled);

    // Don't clobber an invoice that's already moved past the placeholder
    // stage — procurement may have edited it, or finance may have already
    // initiated payment.
    await prisma.invoice.updateMany({
      where: {
        id: invoiceId,
        status: "PENDING",
        amountPaid: 0,
      },
      data: update as never,
    });
  } catch (err) {
    console.error("[ai-prefill] failed:", err);
  }
}
