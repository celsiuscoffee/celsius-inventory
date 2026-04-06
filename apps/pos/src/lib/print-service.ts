/**
 * Print Service — routes print jobs to the correct printer.
 *
 * Receipt → Receipt Printer (customer-facing)
 * Kitchen Docket → Station-specific printer (Bar printer, Kitchen printer, etc.)
 *
 * In production: uses ESC/POS protocol via local print bridge (WebSocket to local service).
 * For now: generates HTML and uses window.print() with the correct content.
 */

export type PrintJob = {
  type: "receipt" | "kitchen_docket";
  station?: string; // For kitchen dockets — which station printer
  content: string; // HTML content to print
};

export type PrinterConfig = {
  id: string;
  name: string;
  type: "receipt" | "kitchen_docket";
  station: string | null; // Kitchen station it serves (null for receipt printers)
  connection: string; // "USB", IP address, etc.
  isOnline: boolean;
};

// ─── Receipt Generation ────────────────────────────────────

export function generateReceiptHTML(order: {
  order_number: string;
  order_type: string;
  table_number?: string | null;
  queue_number?: string | null;
  subtotal: number;
  service_charge: number;
  discount_amount: number;
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

  return `
    <div style="font-family:monospace;width:280px;font-size:12px;color:#000;padding:10px;">
      <div style="text-align:center;margin-bottom:8px;">
        <strong style="font-size:14px;">${branchName}</strong><br/>
        <span style="font-size:10px;">Order: ${order.order_number}</span><br/>
        <span style="font-size:10px;">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span><br/>
        <span style="font-size:10px;">${order.order_type === "dine_in" ? "Dine-in" : "Takeaway"}</span>
      </div>
      ${order.queue_number ? `<div style="text-align:center;margin:8px 0;font-size:28px;font-weight:bold;">${order.queue_number}</div>` : ""}
      <hr style="border:none;border-top:1px dashed #000;"/>
      ${items.map((item) => `
        <div style="display:flex;justify-content:space-between;margin:4px 0;">
          <span>${item.quantity > 1 ? item.quantity + "x " : ""}${item.product_name}${item.variant_name ? " (" + item.variant_name + ")" : ""}</span>
          <span>RM ${(item.item_total / 100).toFixed(2)}</span>
        </div>
        ${item.notes ? `<div style="font-size:10px;color:#666;margin-left:8px;">"${item.notes}"</div>` : ""}
      `).join("")}
      <hr style="border:none;border-top:1px dashed #000;"/>
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>RM ${(order.subtotal / 100).toFixed(2)}</span></div>
      ${order.service_charge > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Service Charge</span><span>RM ${(order.service_charge / 100).toFixed(2)}</span></div>` : ""}
      ${order.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-RM ${(order.discount_amount / 100).toFixed(2)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;">
        <span>TOTAL</span><span>RM ${(order.total / 100).toFixed(2)}</span>
      </div>
      <hr style="border:none;border-top:1px dashed #000;"/>
      ${payments.map((p) => `<div style="display:flex;justify-content:space-between;font-size:10px;"><span>${p.payment_method}</span><span>RM ${(p.amount / 100).toFixed(2)}</span></div>`).join("")}
      <div style="text-align:center;margin-top:12px;font-size:10px;color:#666;">
        Thank you for visiting Celsius Coffee!<br/>celsius.coffee
      </div>
    </div>
  `;
}

// ─── Kitchen Docket Generation ─────────────────────────────

export function generateKitchenDocketHTML(order: {
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
  const date = new Date(order.created_at);

  return `
    <div style="font-family:monospace;width:280px;font-size:14px;color:#000;padding:10px;">
      <div style="text-align:center;margin-bottom:4px;">
        <strong style="font-size:18px;">${station.toUpperCase()}</strong><br/>
        <span style="font-size:12px;">${order.order_number}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <strong>${order.order_type === "dine_in" ? "DINE-IN" : "TAKEAWAY"}</strong>
        <span>${order.order_type === "dine_in" ? "Table " + (order.table_number ?? "—") : order.queue_number ?? "—"}</span>
      </div>
      <div style="font-size:10px;color:#666;">${date.toLocaleTimeString()}</div>
      <hr style="border:none;border-top:2px solid #000;margin:6px 0;"/>
      ${items.map((item) => `
        <div style="margin:6px 0;">
          <strong style="font-size:16px;">${item.quantity > 1 ? item.quantity + "x " : ""}${item.product_name}</strong>
          ${item.variant_name ? `<div style="font-size:12px;">${item.variant_name}</div>` : ""}
          ${formatDocketModifiers(item.modifiers)}
          ${item.notes ? `<div style="font-size:14px;font-weight:bold;margin-top:2px;">** ${item.notes} **</div>` : ""}
        </div>
      `).join("<hr style='border:none;border-top:1px dashed #ccc;'/>")}
      <hr style="border:none;border-top:2px solid #000;margin:6px 0;"/>
      <div style="text-align:center;font-size:10px;">-- END --</div>
    </div>
  `;
}

function formatDocketModifiers(mods: unknown): string {
  if (!Array.isArray(mods) || mods.length === 0) return "";
  const names = mods.map((m: any) => m.option?.name ?? m.group_name ?? "").filter(Boolean);
  return names.length > 0 ? `<div style="font-size:12px;color:#666;">${names.join(", ")}</div>` : "";
}

// ─── Print Dispatch ────────────────────────────────────────

export function printReceipt(html: string) {
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) return;
  printWindow.document.write(`
    <html><head><title>Receipt</title><style>body{margin:0;padding:0;}@media print{body{margin:0;padding:0;}}</style></head>
    <body>${html}</body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  setTimeout(() => printWindow.close(), 1000);
}

export function printKitchenDocket(order: any, branchName: string) {
  // Get unique stations from order items
  const items = order.pos_order_items ?? [];
  const stations = [...new Set(items.map((i: any) => i.kitchen_station).filter(Boolean))] as string[];

  // Print one docket per station
  for (const station of stations) {
    const html = generateKitchenDocketHTML(order, station);
    // In production: send to station-specific printer via ESC/POS WebSocket
    // For now: open print window
    printReceipt(html);
  }
}
