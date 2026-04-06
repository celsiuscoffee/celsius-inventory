"use client";

import { useState, useEffect } from "react";
import { SAMPLE_PROMOTIONS } from "@/lib/sample-promotions";
import { displayRM } from "@/types/database";
import { fetchAllMemberTags } from "@/lib/customer-lookup";
import type { Promotion, DiscountType } from "@/types/database";

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage_off: "% Off",
  amount_off: "Amount Off",
  buy_x_get_y: "Buy X Get Y",
  combo_bundle: "Combo / Bundle",
  override_price: "Override Price",
};

const TYPE_COLORS: Record<DiscountType, string> = {
  percentage_off: "bg-blue-500/20 text-blue-400",
  amount_off: "bg-green-500/20 text-green-400",
  buy_x_get_y: "bg-purple-500/20 text-purple-400",
  combo_bundle: "bg-orange-500/20 text-orange-400",
  override_price: "bg-pink-500/20 text-pink-400",
};

export default function PromotionsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="mt-1 text-sm text-text-muted">{SAMPLE_PROMOTIONS.length} promotions</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          + New Promotion
        </button>
      </div>

      {/* Auto vs Manual info */}
      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-lg border border-border bg-surface-raised p-3">
          <p className="text-xs font-semibold text-text-muted">Auto-Apply (POS)</p>
          <p className="text-[10px] text-text-dim">Buy X Get Y, Combo, Override Price — applied automatically when conditions met</p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface-raised p-3">
          <p className="text-xs font-semibold text-text-muted">Manual Apply</p>
          <p className="text-[10px] text-text-dim">% Off, Amount Off — staff applies on POS, customers use promo code online</p>
        </div>
      </div>

      {/* Promotions list */}
      <div className="mt-4 space-y-3">
        {SAMPLE_PROMOTIONS.map((promo) => (
          <div key={promo.id} className="rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-border-light">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{promo.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_COLORS[promo.discount_type]}`}>
                    {TYPE_LABELS[promo.discount_type]}
                  </span>
                  {promo.discount_type === "buy_x_get_y" || promo.discount_type === "combo_bundle" || promo.discount_type === "override_price" ? (
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">AUTO</span>
                  ) : (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-text-muted">MANUAL</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                  {promo.discount_type === "percentage_off" && <span>{(promo.discount_value ?? 0) / 100}% off</span>}
                  {promo.discount_type === "amount_off" && <span>{displayRM(promo.discount_value ?? 0)} off</span>}
                  {promo.discount_type === "buy_x_get_y" && <span>Buy {promo.buy_quantity} Get {promo.free_quantity} Free</span>}
                  {promo.discount_type === "combo_bundle" && <span>Combo price: {displayRM(promo.combo_price ?? 0)}</span>}
                  {promo.discount_type === "override_price" && <span>New price: {displayRM(promo.override_price ?? 0)}</span>}
                  {promo.promo_code && <span>Code: <code className="rounded bg-surface px-1 font-mono">{promo.promo_code}</code></span>}
                  <span>Channels: {promo.channels.join(", ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${promo.is_enabled ? "bg-success" : "bg-danger"}`} />
                <button onClick={() => setEditingPromo(promo)} className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-text">
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editingPromo) && (
        <PromotionModal
          promotion={editingPromo}
          onClose={() => { setShowAdd(false); setEditingPromo(null); }}
          onSave={() => { setShowAdd(false); setEditingPromo(null); }}
        />
      )}
    </div>
  );
}

function PromotionModal({ promotion, onClose, onSave }: { promotion: Promotion | null; onClose: () => void; onSave: () => void }) {
  const isEditing = promotion !== null;
  const [discountType, setDiscountType] = useState<DiscountType>(promotion?.discount_type ?? "percentage_off");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-2xl rounded-2xl bg-surface-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">{isEditing ? `Edit: ${promotion.name}` : "New Promotion"}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover">&times;</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Name + Code */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Promotion Name *</label>
                <input type="text" defaultValue={promotion?.name ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand focus:ring-1 focus:ring-brand" placeholder="e.g. 10% Off Coffee" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Promo Code (optional)</label>
                <input type="text" defaultValue={promotion?.promo_code ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand font-mono uppercase" placeholder="e.g. SAVE10" />
              </div>
            </div>

            {/* Discount Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Discount Type *</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(TYPE_LABELS) as DiscountType[]).map((type) => (
                  <button key={type} onClick={() => setDiscountType(type)}
                    className={`rounded-lg border px-2 py-2 text-center text-[10px] font-medium transition-colors ${discountType === type ? "border-brand bg-brand/15 text-brand" : "border-border hover:border-brand/50"}`}>
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            {(discountType === "percentage_off" || discountType === "amount_off") && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">
                  {discountType === "percentage_off" ? "Discount Percentage (%)" : "Discount Amount (RM)"}
                </label>
                <input type="number" defaultValue={promotion?.discount_value ? (discountType === "percentage_off" ? (promotion.discount_value / 100) : (promotion.discount_value / 100).toFixed(2)) : ""}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder={discountType === "percentage_off" ? "e.g. 10" : "e.g. 5.00"} />
              </div>
            )}

            {discountType === "buy_x_get_y" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Buy Quantity</label>
                  <input type="number" defaultValue={promotion?.buy_quantity ?? 2} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Get Free Quantity</label>
                  <input type="number" defaultValue={promotion?.free_quantity ?? 1} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
                </div>
              </div>
            )}

            {discountType === "combo_bundle" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Combo Price (RM)</label>
                <input type="number" step="0.01" defaultValue={promotion?.combo_price ? (promotion.combo_price / 100).toFixed(2) : ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" placeholder="e.g. 22.00" />
              </div>
            )}

            {discountType === "override_price" && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">New Price (RM)</label>
                  <input type="number" step="0.01" defaultValue={promotion?.override_price ? (promotion.override_price / 100).toFixed(2) : ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Min Quantity</label>
                  <input type="number" defaultValue={promotion?.apply_min_qty ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Max Quantity</label>
                  <input type="number" defaultValue={promotion?.apply_max_qty ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
                </div>
              </div>
            )}

            {/* Apply To */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Apply To</label>
              <select defaultValue={promotion?.apply_to ?? "all_orders"} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand">
                <option value="all_orders">All Orders</option>
                <option value="orders_over">Orders over or equal to</option>
                <option value="category">Products of Category</option>
                <option value="tags">Products with Tags</option>
                <option value="specific_products">Specific Products</option>
              </select>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Start Date</label>
                <input type="date" defaultValue={promotion?.start_date?.split("T")[0] ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">End Date (blank = no end)</label>
                <input type="date" defaultValue={promotion?.end_date?.split("T")[0] ?? ""} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand" />
              </div>
            </div>

            {/* Channels + Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Channels</label>
                <div className="flex flex-wrap gap-2">
                  {["pos", "online", "qr", "delivery"].map((ch) => (
                    <label key={ch} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" defaultChecked={promotion?.channels.includes(ch) ?? ch === "pos"} className="h-3.5 w-3.5 accent-brand" />
                      <span className="capitalize">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Options</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" defaultChecked={promotion?.is_enabled ?? false} className="h-3.5 w-3.5 accent-brand" />
                    Enable immediately
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" defaultChecked={promotion?.allow_repeat ?? false} className="h-3.5 w-3.5 accent-brand" />
                    Allow repeat in single transaction
                  </label>
                </div>
              </div>
            {/* Customer Eligibility (StoreHub-style) */}
            <div className="rounded-lg border border-border bg-surface p-3">
              <h4 className="text-xs font-semibold text-text-muted mb-2">Customer Eligibility</h4>
              <select
                defaultValue={promotion?.customer_eligibility ?? "everyone"}
                className="h-9 w-full rounded-lg border border-border bg-surface-raised px-3 text-sm text-text outline-none focus:border-brand mb-2"
              >
                <option value="everyone">Everyone / All Customers</option>
                <option value="customer_tags">By Customer Tags (VIP, Staff, Loyal, etc.)</option>
                <option value="membership">By Membership Tier (SH_Tier_1-4)</option>
                <option value="first_time">First Time Customers Only</option>
              </select>
              <p className="text-[10px] text-text-dim mb-2">
                Tags from Loyalty system: VIP, Staff, Loyal, Resident, SH_Tier_1-4, Shah Alam, Putrajaya, RPS
              </p>
              <div className="flex flex-wrap gap-1">
                {["VIP", "Staff", "Loyal", "Resident", "SH_Tier_1", "SH_Tier_2", "SH_Tier_3", "SH_Tier_4"].map((tag) => (
                  <label key={tag} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] hover:border-brand">
                    <input type="checkbox" className="h-3 w-3 accent-brand" />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover">Cancel</button>
          <button onClick={onSave} className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            {isEditing ? "Save Changes" : "Create Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
}
