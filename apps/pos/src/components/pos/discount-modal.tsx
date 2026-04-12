"use client";

import { useState } from "react";
import { displayRM } from "@/types/database";
import { usePOS } from "@/lib/pos-context";
import type { CartItem } from "@/types/database";

type Props = {
  subtotal: number;
  items: CartItem[];
  onApplyOrder: (discountAmount: number) => void;
  onApplyItem: (cartItemId: string, discountAmount: number) => void;
  onClose: () => void;
};

export function DiscountModal({ subtotal, items, onApplyOrder, onApplyItem, onClose }: Props) {
  const { staff } = usePOS();
  const [mode, setMode] = useState<"order" | "item">("order");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [pinError, setPinError] = useState("");

  const needsManagerOverride = staff?.role === "staff";
  const numValue = parseFloat(value) || 0;

  const selectedItem = items.find((i) => i.cartItemId === selectedItemId);
  const targetAmount = mode === "item" && selectedItem ? selectedItem.lineTotal : subtotal;

  const discountAmount =
    type === "percent"
      ? Math.round(targetAmount * (numValue / 100))
      : Math.round(numValue * 100); // convert RM to sen

  const finalAmount = Math.max(0, targetAmount - discountAmount);

  async function handleApply() {
    if (needsManagerOverride) {
      if (!managerPin || managerPin.length < 4) {
        setPinError("Enter manager PIN");
        return;
      }
      // Verify manager PIN via server-side API
      try {
        const res = await fetch("/api/auth/verify-manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: managerPin }),
        });
        if (!res.ok) {
          setPinError("Invalid manager PIN");
          return;
        }
      } catch {
        setPinError("Verification failed");
        return;
      }
    }

    if (discountAmount > 0 && discountAmount <= targetAmount) {
      if (mode === "item" && selectedItemId) {
        onApplyItem(selectedItemId, discountAmount);
      } else {
        onApplyOrder(discountAmount);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Apply Discount</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover">&times;</button>
        </div>

        <div className="px-5 py-4">
          {/* Discount scope: order vs item */}
          <div className="mb-4 flex rounded-lg border border-border">
            <button
              onClick={() => { setMode("order"); setSelectedItemId(null); setValue(""); }}
              className={`flex-1 rounded-l-lg py-2 text-sm font-medium transition-colors ${mode === "order" ? "bg-brand text-white" : "text-text-muted"}`}
            >
              Whole Order
            </button>
            <button
              onClick={() => { setMode("item"); setValue(""); }}
              className={`flex-1 rounded-r-lg py-2 text-sm font-medium transition-colors ${mode === "item" ? "bg-brand text-white" : "text-text-muted"}`}
            >
              Single Item
            </button>
          </div>

          {/* Item selector (when mode = item) */}
          {mode === "item" && (
            <div className="mb-4 max-h-32 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.cartItemId}
                  onClick={() => setSelectedItemId(item.cartItemId)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    selectedItemId === item.cartItemId
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border hover:border-brand/50"
                  }`}
                >
                  <span className="font-medium">
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.product.name}
                  </span>
                  <span>{displayRM(item.lineTotal)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Cannot proceed without selecting item */}
          {mode === "item" && !selectedItemId && (
            <p className="mb-3 text-center text-xs text-text-muted">Select an item above</p>
          )}

          {/* Discount type + value (show when target selected) */}
          {(mode === "order" || selectedItemId) && (
            <>
              {/* Discount type toggle */}
              <div className="mb-3 flex rounded-lg border border-border">
                <button
                  onClick={() => { setType("percent"); setValue(""); }}
                  className={`flex-1 rounded-l-lg py-2 text-sm font-medium transition-colors ${type === "percent" ? "bg-brand text-white" : "text-text-muted"}`}
                >
                  Percentage (%)
                </button>
                <button
                  onClick={() => { setType("fixed"); setValue(""); }}
                  className={`flex-1 rounded-r-lg py-2 text-sm font-medium transition-colors ${type === "fixed" ? "bg-brand text-white" : "text-text-muted"}`}
                >
                  Fixed (RM)
                </button>
              </div>

              {/* Quick discount buttons */}
              {type === "percent" && (
                <div className="mb-3 flex gap-2">
                  {[5, 10, 15, 20, 50].map((pct) => (
                    <button key={pct} onClick={() => setValue(String(pct))}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${value === String(pct) ? "border-brand bg-brand/15 text-brand" : "border-border hover:bg-surface-hover"}`}>
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              {/* Value input */}
              <div className="mb-3">
                <input
                  type="number"
                  step={type === "percent" ? "1" : "0.01"}
                  min="0"
                  max={type === "percent" ? "100" : (targetAmount / 100).toFixed(2)}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "percent" ? "e.g. 10" : "e.g. 5.00"}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  autoFocus
                />
              </div>

              {/* Preview */}
              {numValue > 0 && (
                <div className="mb-3 rounded-lg bg-surface p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">{mode === "item" ? selectedItem?.product.name : "Order Total"}</span>
                    <span>{displayRM(targetAmount)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Discount {type === "percent" ? `(${numValue}%)` : ""}</span>
                    <span>-{displayRM(discountAmount)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1 font-bold">
                    <span>After Discount</span>
                    <span>{displayRM(finalAmount)}</span>
                  </div>
                </div>
              )}

              {/* Manager PIN */}
              {needsManagerOverride && (
                <div className="mb-3">
                  <label className="mb-1 block text-xs text-warning">Manager PIN required</label>
                  <input type="password" maxLength={6} value={managerPin}
                    onChange={(e) => { setManagerPin(e.target.value); setPinError(""); }}
                    placeholder="Enter manager PIN"
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-warning focus:ring-1 focus:ring-warning" />
                  {pinError && <p className="mt-1 text-xs text-danger">{pinError}</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            onClick={handleApply}
            disabled={discountAmount <= 0 || discountAmount > targetAmount || (mode === "item" && !selectedItemId)}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Apply Discount &middot; -{displayRM(discountAmount)}
          </button>
        </div>
      </div>
    </div>
  );
}
