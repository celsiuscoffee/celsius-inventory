"use client";

import { displayRM } from "@/types/database";
import { format } from "date-fns";

type Props = {
  order: any;
  branchName: string;
  branchAddress: string;
  onClose: () => void;
  onPrint: () => void;
};

export function ReceiptView({ order, branchName, branchAddress, onClose, onPrint }: Props) {
  // Normalize items — handle both old format and DB format
  const items = (order.pos_order_items ?? order.items ?? []).map((item: any) => ({
    name: item.product_name ?? item.name ?? "Item",
    variant: item.variant_name ?? item.variant ?? null,
    quantity: item.quantity ?? 1,
    total: item.item_total ?? item.total ?? 0,
    modifiers: formatModifiers(item.modifiers),
    notes: item.notes ?? null,
  }));

  // Normalize payment method
  const payments = order.pos_order_payments ?? [];
  const paymentMethod = payments.length > 0
    ? payments.map((p: any) => p.payment_method).join(", ")
    : (order.payment_method ?? "—");

  // Normalize discount
  const discount = order.discount_amount ?? order.discount ?? 0;

  // Parse date safely
  let dateStr = "";
  try {
    dateStr = format(new Date(order.created_at), "dd/MM/yyyy h:mm a");
  } catch {
    dateStr = order.created_at ?? "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm">
        {/* Receipt paper */}
        <div className="rounded-t-2xl bg-white p-6 text-black">
          {/* Header */}
          <div className="text-center">
            <img src="/images/celsius-logo-sm.jpg" alt="Celsius" width={40} height={40} className="mx-auto rounded-lg" />
            <h3 className="mt-2 text-sm font-bold">{branchName}</h3>
            {branchAddress && <p className="text-[10px] text-gray-500">{branchAddress}</p>}
          </div>

          <div className="my-3 border-t border-dashed border-gray-300" />

          {/* Order info */}
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Order: {order.order_number}</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Type: {order.order_type === "dine_in" ? "Dine-in" : "Takeaway"}</span>
            <span>{paymentMethod}</span>
          </div>
          {order.queue_number && (
            <div className="mt-2 text-center">
              <p className="text-[10px] text-gray-500">Queue Number</p>
              <p className="text-2xl font-black">{order.queue_number}</p>
            </div>
          )}
          {order.table_number && (
            <div className="mt-1 text-center text-xs text-gray-600">
              Table {order.table_number}
            </div>
          )}

          <div className="my-3 border-t border-dashed border-gray-300" />

          {/* Items */}
          <div className="space-y-1.5">
            {items.map((item: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs">
                  <span>
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.name}
                    {item.variant && ` (${item.variant})`}
                  </span>
                  <span className="font-medium">{displayRM(item.total)}</span>
                </div>
                {item.modifiers && (
                  <p className="pl-2 text-[10px] text-gray-400">{item.modifiers}</p>
                )}
                {item.notes && (
                  <p className="pl-2 text-[10px] italic text-gray-400">&ldquo;{item.notes}&rdquo;</p>
                )}
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-dashed border-gray-300" />

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{displayRM(order.subtotal)}</span>
            </div>
            {(order.service_charge ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Service Charge</span>
                <span>{displayRM(order.service_charge)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span>-{displayRM(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-bold">
              <span>TOTAL</span>
              <span>{displayRM(order.total)}</span>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-gray-300" />

          {/* Payment */}
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Payment</span>
            <span>{paymentMethod}</span>
          </div>

          <div className="my-3 border-t border-dashed border-gray-300" />

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400">
            <p>Thank you for visiting Celsius Coffee!</p>
            <p className="mt-1">celsius.coffee</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 rounded-b-2xl bg-surface-raised p-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface-hover">
            Close
          </button>
          <button onClick={onPrint} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

/** Extract readable modifier names from JSONB modifier data */
function formatModifiers(mods: unknown): string | null {
  if (!mods) return null;
  if (!Array.isArray(mods) || mods.length === 0) return null;

  // Handle both formats:
  // POS format: [{group_name, option: {name, price}}]
  // StoreHub format: [{id, name, options: [{label, priceDelta}]}]
  const names = mods.map((m: any) => {
    if (m.option?.name) return m.option.name; // POS format
    if (m.label) return m.label; // flat
    if (m.name && !m.options) return m.name; // simple name
    return null;
  }).filter(Boolean);

  return names.length > 0 ? names.join(", ") : null;
}
