"use client";

import type { CartItem } from "@/types/database";
import { displayRM } from "@/types/database";

type Props = {
  items: CartItem[];
  orderType: "dine_in" | "takeaway";
  subtotal: number;
  serviceCharge: number;
  discount: number;
  total: number;
  itemCount: number;
  editingOrderId: string | null;
  tableNumber: string;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onCharge: () => void;
  onSendToKitchen: () => void;
  onDiscount: () => void;
};

export function OrderPanel({
  items,
  orderType,
  subtotal,
  serviceCharge,
  discount,
  total,
  itemCount,
  editingOrderId,
  tableNumber,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCharge,
  onSendToKitchen,
  onDiscount,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {editingOrderId ? "Edit Order" : "Current Order"}
          </h2>
          <span className="text-xs text-text-muted">
            {orderType === "dine_in" ? "Dine-in" : "Takeaway"}
            {tableNumber && ` · Table ${tableNumber}`}
            {" · "}{itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
        </div>
        {items.length > 0 && (
          <button onClick={onClearCart} className="text-xs font-medium text-danger hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <span className="text-3xl">🛒</span>
            <p className="mt-2 text-sm">No items yet</p>
            <p className="text-xs text-text-dim">Tap a product to add it</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.cartItemId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className="mt-0.5 text-xs text-text-muted">
                        {item.selectedModifiers.map((m) => m.option.name).join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs italic text-text-dim">&ldquo;{item.notes}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold">{displayRM(item.lineTotal)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-surface-hover"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm font-medium hover:bg-surface-hover"
                  >
                    +
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => onRemoveItem(item.cartItemId)} className="text-xs text-text-dim hover:text-danger">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4">
        {/* Discount button */}
        {items.length > 0 && (
          <button
            onClick={onDiscount}
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-xs transition-colors hover:border-brand hover:bg-brand/5"
          >
            <span className="text-text-muted">
              {discount > 0 ? `Discount applied: -${displayRM(discount)}` : "Add discount"}
            </span>
            <span className="text-brand">{discount > 0 ? "Edit" : "+"}</span>
          </button>
        )}

        {/* Totals */}
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Subtotal</span>
            <span>{displayRM(subtotal)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Service Charge</span>
              <span>{displayRM(serviceCharge)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Discount</span>
              <span className="text-success">-{displayRM(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{displayRM(total)}</span>
          </div>
        </div>

        {/* Action buttons */}
        {orderType === "dine_in" && items.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={onSendToKitchen}
              className="flex-1 rounded-xl bg-surface-raised py-3 text-sm font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              {editingOrderId ? "Update Kitchen" : "Send to Kitchen"}
            </button>
            <button
              onClick={onCharge}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Charge {displayRM(total)}
            </button>
          </div>
        ) : (
          <button
            disabled={items.length === 0}
            onClick={onCharge}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {items.length === 0 ? "Add items to charge" : `Charge ${displayRM(total)}`}
          </button>
        )}
      </div>
    </div>
  );
}
