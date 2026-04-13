/**
 * SUNMI D3 MINI Printer Integration
 *
 * Printing architecture (priority order):
 * 1. Capacitor native plugin → SUNMI AIDL service (when running as Android app)
 * 2. SUNMI JS Bridge → window.sunmiInnerPrinter (when running in SUNMI WebView)
 * 3. External printer bridge → HTTP POST to localhost:8080 (USB/network printers)
 * 4. Browser print dialog → fallback for development
 */

import SunmiPrinter, { isCapacitorNative } from "./sunmi-capacitor";

// ─── SUNMI JS Bridge Detection (legacy WebView mode) ─────

declare global {
  interface Window {
    sunmiInnerPrinter?: SunmiJSBridge;
    PrinterManager?: SunmiJSBridge;
    AndroidBridge?: { print: (data: string) => void };
  }
}

interface SunmiJSBridge {
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
  return isCapacitorNative() || !!(window.sunmiInnerPrinter || window.PrinterManager);
}

function getSunmiJSBridge(): SunmiJSBridge | null {
  return window.sunmiInnerPrinter ?? window.PrinterManager ?? null;
}

// ─── ESC/POS Command Builder (58mm = 32 chars) ────────────

const CHARS_PER_LINE = 32; // 58mm paper, standard font

function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len);
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

  lines.push(centerText(`** ${(station || "KITCHEN").toUpperCase()} **`));
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
 * Print via Capacitor native SUNMI plugin (highest priority)
 */
async function printViaNative(text: string): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const { connected } = await SunmiPrinter.isConnected();
    if (!connected) return false;
    await SunmiPrinter.printReceipt({ text });
    return true;
  } catch (err) {
    console.error("[SUNMI/Native] Print error:", err);
    return false;
  }
}

/**
 * Print via SUNMI JS Bridge (legacy WebView mode)
 */
async function printViaJSBridge(text: string): Promise<boolean> {
  const printer = getSunmiJSBridge();
  if (!printer) return false;
  try {
    printer.printerInit?.();
    printer.setFontSize?.(24);
    printer.printText?.(text);
    printer.cutPaper?.();
    return true;
  } catch (err) {
    console.error("[SUNMI/JSBridge] Print error:", err);
    return false;
  }
}

/**
 * Print receipt — tries native → JS bridge → browser fallback
 */
export async function printReceipt58mm(order: any, branchName: string) {
  const text = formatReceipt(order, branchName);

  // 1. Capacitor native plugin (AIDL)
  if (await printViaNative(text)) return;

  // 2. SUNMI JS Bridge (WebView)
  if (await printViaJSBridge(text)) return;

  // 3. Fallback: browser print dialog
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
 * Print kitchen docket — tries external printer → native → JS bridge → browser
 */
export async function printKitchenDocket58mm(order: any, branchName: string) {
  const items = order.pos_order_items ?? [];
  const stationSet = new Set(items.map((i: any) => i.kitchen_station).filter(Boolean)) as Set<string>;

  // If no items have a station assigned, print all items under "Kitchen"
  if (stationSet.size === 0) {
    const text = formatKitchenDocket(order, "");
    if (text) {
      if (await printViaNative(text)) return;
      if (await printViaJSBridge(text)) return;
      const printWindow = window.open("", "_blank", "width=350,height=400");
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Kitchen Docket</title>
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
    return;
  }

  const stations = [...stationSet];

  for (const station of stations) {
    const text = formatKitchenDocket(order, station);
    if (!text) continue;

    // 1. External printer bridge (USB/network kitchen printers)
    if (await printToExternalPrinter(station, text)) continue;

    // 2. Capacitor native plugin
    if (await printViaNative(text)) continue;

    // 3. SUNMI JS Bridge
    if (await printViaJSBridge(text)) continue;

    // 4. Browser fallback
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

export async function printToExternalPrinter(station: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:8080/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printer: station.toLowerCase(), data: text }),
    });
    return res.ok;
  } catch {
    console.warn(`[PRINT] External printer bridge not available for station: ${station}`);
    return false;
  }
}

// ─── Re-exports for backward compat ──────────────────────

/** @deprecated Use printReceipt58mm instead */
export const printToSunmi = printViaJSBridge;
