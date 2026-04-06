/**
 * SUNMI D3 MINI Printer Integration
 *
 * Printing architecture:
 * 1. Built-in 58mm thermal printer → receipts (via SUNMI JS Bridge)
 * 2. External USB/Network printers → kitchen dockets per station
 *
 * The SUNMI JS Bridge is available when running inside SUNMI's WebView
 * or a WebView wrapper app. It exposes `window.sunmiInnerPrinter`.
 *
 * For external printers, we use WebSocket to a local print bridge service
 * that routes ESC/POS commands to the correct USB/Network printer.
 */

// ─── SUNMI JS Bridge Detection ────────────────────────────

declare global {
  interface Window {
    sunmiInnerPrinter?: SunmiPrinter;
    PrinterManager?: SunmiPrinter;
    AndroidBridge?: { print: (data: string) => void };
  }
}

interface SunmiPrinter {
  sendRawData?: (base64data: string) => void;
  printText?: (text: string, callback?: unknown) => void;
  printBarCode?: (data: string, symbology: number, height: number, width: number, callback?: unknown) => void;
  printQRCode?: (data: string, size: number, callback?: unknown) => void;
  lineWrap?: (n: number, callback?: unknown) => void;
  cutPaper?: (callback?: unknown) => void;
  setAlignment?: (alignment: number, callback?: unknown) => void;
  setFontSize?: (size: number, callback?: unknown) => void;
  setBold?: (bold: boolean, callback?: unknown) => void;
  printerInit?: (callback?: unknown) => void;
}

export function isSunmiDevice(): boolean {
  return !!(window.sunmiInnerPrinter || window.PrinterManager);
}

function getSunmiPrinter(): SunmiPrinter | null {
  return window.sunmiInnerPrinter ?? window.PrinterManager ?? null;
}

// ─── ESC/POS Command Builder (58mm = 32 chars) ────────────

const ESC = "\x1B";
const GS = "\x1D";
const CHARS_PER_LINE = 32; // 58mm paper, standard font

function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len);
}

function padLeft(str: string, len: number): string {
  return str.substring(0, len).padStart(len);
}

function centerText(str: string): string {
  const pad = Math.max(0, Math.floor((CHARS_PER_LINE - str.length) / 2));
  return " ".repeat(pad) + str;
}

function divider(char = "-"): string {
  return char.repeat(CHARS_PER_LINE);
}

function twoColumn(left: string, right: string): string {
  const maxLeft = CHARS_PER_LINE - right.length - 1;
  return padRight(left, maxLeft) + " " + right;
}

// ─── Receipt Formatter (58mm) ──────────────────────────────

export function formatReceipt(order: {
  order_number: string;
  order_type: string;
  table_number?: string | null;
  queue_number?: string | null;
  subtotal: number;
  service_charge: number;
  discount_amount: number;
  promo_discount?: number;
  total: number;
  created_at: string;
  employee_id?: string;
  pos_order_items?: {
    product_name: string;
    variant_name?: string | null;
    quantity: number;
    unit_price: number;
    modifier_total: number;
    item_total: number;
    modifiers?: unknown;
    notes?: string | null;
  }[];
  pos_order_payments?: {
    payment_method: string;
    amount: number;
  }[];
}, branchName: string): string {
  const items = order.pos_order_items ?? [];
  const payments = order.pos_order_payments ?? [];
  const date = new Date(order.created_at);
  const rm = (sen: number) => `RM ${(sen / 100).toFixed(2)}`;

  const lines: string[] = [];

  // Header
  lines.push(centerText(branchName));
  lines.push(centerText(""));
  lines.push(divider("="));
  lines.push(twoColumn("Order:", order.order_number));
  lines.push(twoColumn("Date:", date.toLocaleDateString()));
  lines.push(twoColumn("Time:", date.toLocaleTimeString()));
  lines.push(twoColumn("Type:", order.order_type === "dine_in" ? "Dine-in" : "Takeaway"));

  if (order.queue_number) {
    lines.push(divider());
    lines.push(centerText("QUEUE NUMBER"));
    lines.push(centerText(`** ${order.queue_number} **`));
  }
  if (order.table_number) {
    lines.push(twoColumn("Table:", order.table_number));
  }

  lines.push(divider("="));

  // Items
  for (const item of items) {
    const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
    const name = `${qty}${item.product_name}`;
    const price = rm(item.item_total);
    lines.push(twoColumn(name, price));

    if (item.variant_name) {
      lines.push(`  ${item.variant_name}`);
    }

    // Modifiers
    const mods = item.modifiers;
    if (Array.isArray(mods) && mods.length > 0) {
      const modNames = mods.map((m: any) => m.option?.name ?? m.group_name ?? "").filter(Boolean);
      if (modNames.length > 0) {
        lines.push(`  ${modNames.join(", ")}`);
      }
    }

    if (item.notes) {
      lines.push(`  ** ${item.notes} **`);
    }
  }

  lines.push(divider());

  // Totals
  lines.push(twoColumn("Subtotal", rm(order.subtotal)));
  if (order.service_charge > 0) {
    lines.push(twoColumn("Service Charge", rm(order.service_charge)));
  }
  if (order.discount_amount > 0) {
    lines.push(twoColumn("Discount", `-${rm(order.discount_amount)}`));
  }
  if ((order.promo_discount ?? 0) > 0) {
    lines.push(twoColumn("Promo", `-${rm(order.promo_discount!)}`));
  }
  lines.push(divider());
  lines.push(twoColumn("TOTAL", rm(order.total)));
  lines.push(divider());

  // Payment
  for (const p of payments) {
    lines.push(twoColumn(p.payment_method, rm(p.amount)));
  }

  lines.push("");
  lines.push(centerText("Thank you!"));
  lines.push(centerText("celsius.coffee"));
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

// ─── Kitchen Docket Formatter (58mm) ───────────────────────

export function formatKitchenDocket(order: {
  order_number: string;
  order_type: string;
  table_number?: string | null;
  queue_number?: string | null;
  created_at: string;
  pos_order_items?: {
    product_name: string;
    variant_name?: string | null;
    quantity: number;
    kitchen_station?: string | null;
    modifiers?: unknown;
    notes?: string | null;
  }[];
}, station: string): string {
  const items = (order.pos_order_items ?? []).filter(
    (i) => !station || i.kitchen_station === station
  );
  if (items.length === 0) return "";

  const date = new Date(order.created_at);
  const lines: string[] = [];

  lines.push(centerText(`** ${station.toUpperCase()} **`));
  lines.push(divider("="));
  lines.push(twoColumn("Order:", order.order_number));
  lines.push(twoColumn(
    order.order_type === "dine_in" ? "DINE-IN" : "TAKEAWAY",
    order.order_type === "dine_in" ? `Table ${order.table_number ?? "-"}` : (order.queue_number ?? "-")
  ));
  lines.push(twoColumn("Time:", date.toLocaleTimeString()));
  lines.push(divider("="));

  for (const item of items) {
    const qty = item.quantity > 1 ? `${item.quantity}x ` : "";
    lines.push(`${qty}${item.product_name}`);
    if (item.variant_name) lines.push(`  ${item.variant_name}`);

    const mods = item.modifiers;
    if (Array.isArray(mods) && mods.length > 0) {
      const modNames = mods.map((m: any) => m.option?.name ?? "").filter(Boolean);
      if (modNames.length > 0) lines.push(`  ${modNames.join(", ")}`);
    }
    if (item.notes) lines.push(`  ** ${item.notes} **`);
    lines.push(divider("-"));
  }

  lines.push(centerText("-- END --"));
  lines.push("");
  lines.push("");

  return lines.join("\n");
}

// ─── Print Dispatch ────────────────────────────────────────

/**
 * Print to SUNMI built-in printer (receipt)
 */
export async function printToSunmi(text: string): Promise<boolean> {
  const printer = getSunmiPrinter();
  if (!printer) return false;

  try {
    printer.printerInit?.();
    printer.setFontSize?.(24);
    printer.printText?.(text);
    printer.cutPaper?.();
    return true;
  } catch (err) {
    console.error("[SUNMI] Print error:", err);
    return false;
  }
}

/**
 * Print receipt — tries SUNMI first, falls back to browser print
 */
export async function printReceipt58mm(order: any, branchName: string) {
  const text = formatReceipt(order, branchName);

  // Try SUNMI built-in printer
  if (isSunmiDevice()) {
    const success = await printToSunmi(text);
    if (success) return;
  }

  // Fallback: open print dialog with formatted text
  const printWindow = window.open("", "_blank", "width=350,height=600");
  if (!printWindow) return;
  printWindow.document.write(`
    <html><head><title>Receipt</title>
    <style>body{font-family:monospace;font-size:12px;width:58mm;margin:0;padding:4mm;white-space:pre-wrap;}
    @media print{body{margin:0;padding:2mm;}}</style></head>
    <body>${text}</body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  setTimeout(() => printWindow.close(), 2000);
}

/**
 * Print kitchen docket — tries SUNMI/external printer per station, falls back to browser
 */
export async function printKitchenDocket58mm(order: any, branchName: string) {
  const items = order.pos_order_items ?? [];
  const stations = [...new Set(items.map((i: any) => i.kitchen_station).filter(Boolean))] as string[];

  if (stations.length === 0) {
    // No kitchen stations assigned — print all items as one docket
    stations.push("Kitchen");
  }

  for (const station of stations) {
    const text = formatKitchenDocket(order, station);
    if (!text) continue;

    // 1. Try external printer bridge (USB/network kitchen printers)
    const external = await printToExternalPrinter(station, text);
    if (external) continue;

    // 2. Try SUNMI built-in printer
    if (isSunmiDevice()) {
      await printToSunmi(text);
      continue;
    }

    // 3. Fallback: browser print
    const printWindow = window.open("", "_blank", "width=350,height=400");
    if (!printWindow) continue;
    printWindow.document.write(`
      <html><head><title>${station} Docket</title>
      <style>body{font-family:monospace;font-size:14px;font-weight:bold;width:58mm;margin:0;padding:4mm;white-space:pre-wrap;}
      @media print{body{margin:0;padding:2mm;}}</style></head>
      <body>${text}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 2000);
  }
}

// ─── External Printer Bridge (for USB/Network kitchen printers) ───

/**
 * For external printers connected via USB or network,
 * a local bridge service handles routing.
 *
 * The bridge runs on the SUNMI device (or local network) and exposes:
 * POST http://localhost:8080/print
 * {
 *   "printer": "kitchen" | "bar" | "receipt",
 *   "data": "ESC/POS text or base64"
 * }
 *
 * This can be a simple Android app or Node.js service.
 */
export async function printToExternalPrinter(station: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:8080/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer: station.toLowerCase(), data: text }),
    });
    return res.ok;
  } catch {
    // External bridge not running — fall back to SUNMI built-in
    console.warn(`[PRINT] External printer bridge not available for station: ${station}`);
    return false;
  }
}
