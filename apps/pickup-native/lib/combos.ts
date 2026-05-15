import { supabase } from "./supabase";

/**
 * Active-combo discovery for the customer side. Pickup-native uses
 * this to:
 *   - Highlight pair-with cards that would unlock a combo with the
 *     current product on the detail screen ("Save RM4 combo").
 *   - Estimate the combo discount locally so the customer sees the
 *     savings BEFORE checkout. Server still re-evaluates and is the
 *     source of truth.
 *
 * We pull `promotions` directly via the anon-key Supabase client —
 * the table has read RLS open for active rows because the discount
 * engine is exposed on a per-evaluation basis anyway, and showing
 * the customer "what combos exist" is a feature, not a leak.
 */

export type ComboPromotion = {
  id: string;
  name: string;
  description: string | null;
  combo_product_ids: string[];
  combo_price: number;          // RM
  outlet_ids: string[];         // empty = all outlets
  valid_from: string | null;
  valid_until: string | null;
  priority: number;
};

/** Pull every active combo_price promotion for the brand. Filtered
 *  by valid window + outlet later inside the helpers. */
export async function fetchActiveCombos(): Promise<ComboPromotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, name, description, combo_product_ids, combo_price, outlet_ids, valid_from, valid_until, priority, is_active, discount_type",
    )
    .eq("brand_id", "brand-celsius")
    .eq("discount_type", "combo_price")
    .eq("is_active", true);
  if (error) {
    console.warn("[combos] fetch failed", error);
    return [];
  }
  const now = new Date();
  return (data ?? [])
    .filter((p) => {
      const from = p.valid_from ? new Date(p.valid_from) : null;
      const until = p.valid_until ? new Date(p.valid_until) : null;
      if (from && from > now) return false;
      if (until && until < now) return false;
      if (!Array.isArray(p.combo_product_ids) || p.combo_product_ids.length < 2) return false;
      if (p.combo_price == null) return false;
      return true;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      combo_product_ids: p.combo_product_ids,
      combo_price: Number(p.combo_price),
      outlet_ids: Array.isArray(p.outlet_ids) ? p.outlet_ids : [],
      valid_from: p.valid_from,
      valid_until: p.valid_until,
      priority: p.priority ?? 0,
    }));
}

/** Combos that include the current product AND are valid at the
 *  current outlet. Sorted by priority (highest first) so the
 *  "best" combo wins when multiple match a partner product. */
export function combosIncludingProduct(
  combos: ComboPromotion[],
  productId: string,
  outletId: string | null,
): ComboPromotion[] {
  return combos
    .filter((c) => c.combo_product_ids.includes(productId))
    .filter(
      (c) =>
        c.outlet_ids.length === 0 ||
        (outletId != null && c.outlet_ids.includes(outletId)),
    )
    .sort((a, b) => b.priority - a.priority);
}

/** Per-product savings preview for the pair-with badge. Returns the
 *  best combo a customer would unlock by adding `pairProductId` on
 *  top of `currentProductId`, plus the RM saved at default prices.
 *  Returns null if no combo applies. */
export function bestComboForPair(args: {
  combos: ComboPromotion[];
  currentProductId: string;
  currentProductPrice: number;
  pairProductId: string;
  pairProductPrice: number;
  outletId: string | null;
}): { combo: ComboPromotion; savings: number } | null {
  const eligible = combosIncludingProduct(args.combos, args.currentProductId, args.outletId)
    .filter((c) => c.combo_product_ids.includes(args.pairProductId));
  if (eligible.length === 0) return null;
  // Pick the combo with the biggest savings against the default
  // (un-modified) prices for these two products. The server will
  // re-compute with the actual modifier-loaded prices at checkout;
  // this preview is intentionally conservative-shaped.
  let best: { combo: ComboPromotion; savings: number } | null = null;
  for (const c of eligible) {
    const bundleSubtotal = args.currentProductPrice + args.pairProductPrice;
    const savings = Math.max(0, bundleSubtotal - c.combo_price);
    if (savings <= 0) continue;
    if (!best || savings > best.savings) best = { combo: c, savings };
  }
  return best;
}
