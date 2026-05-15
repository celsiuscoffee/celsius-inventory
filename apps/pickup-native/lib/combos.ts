import { supabase } from "./supabase";

/**
 * Active-promotion discovery for the customer side. Loads any
 * "combo-shaped" promotion — anything carrying a product gate or a
 * category gate — and exposes helpers that let the product detail
 * screen highlight pair-with items that would trigger a discount.
 *
 * The discount type itself can be anything (combo_price for a fixed
 * bundle, fixed_amount_off for "RM2 off", percentage_off for "10%
 * off bundles", etc). All we care about on the client is "would
 * adding this pair trigger savings, and how much".
 */

export type ComboPromotion = {
  id: string;
  name: string;
  description: string | null;
  discount_type:
    | "percentage_off"
    | "fixed_amount_off"
    | "free_item"
    | "bogo"
    | "combo_price"
    | "override_price";
  discount_value: number | null;
  max_discount_value: number | null;
  combo_price: number | null;
  override_price: number | null;
  combo_product_ids: string[];
  combo_category_ids: string[];
  applicable_products: string[];
  applicable_categories: string[];
  outlet_ids: string[];
  valid_from: string | null;
  valid_until: string | null;
  day_of_week: number[];
  time_start: string | null;  // "HH:MM" 24h
  time_end: string | null;
  priority: number;
};

/** Pull every active combo-shaped promotion. Filtered to those with
 *  at least one gate set so we don't pollute the customer-side view
 *  with general percentage-off promos that aren't pair-driven. */
export async function fetchActiveCombos(): Promise<ComboPromotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, name, description, discount_type, discount_value, max_discount_value, combo_price, override_price, combo_product_ids, combo_category_ids, applicable_products, applicable_categories, outlet_ids, valid_from, valid_until, day_of_week, time_start, time_end, priority, is_active",
    )
    .eq("brand_id", "brand-celsius")
    .eq("is_active", true);
  if (error) {
    console.warn("[combos] fetch failed", error);
    return [];
  }
  return (data ?? [])
    .filter((p) => {
      const productGate  = Array.isArray(p.combo_product_ids)  && p.combo_product_ids.length  > 0;
      const categoryGate = Array.isArray(p.combo_category_ids) && p.combo_category_ids.length > 0;
      return productGate || categoryGate;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      discount_type: p.discount_type,
      discount_value: p.discount_value == null ? null : Number(p.discount_value),
      max_discount_value: p.max_discount_value == null ? null : Number(p.max_discount_value),
      combo_price: p.combo_price == null ? null : Number(p.combo_price),
      override_price: p.override_price == null ? null : Number(p.override_price),
      combo_product_ids:  Array.isArray(p.combo_product_ids)  ? p.combo_product_ids  : [],
      combo_category_ids: Array.isArray(p.combo_category_ids) ? p.combo_category_ids : [],
      applicable_products:   Array.isArray(p.applicable_products)   ? p.applicable_products   : [],
      applicable_categories: Array.isArray(p.applicable_categories) ? p.applicable_categories : [],
      outlet_ids:  Array.isArray(p.outlet_ids)  ? p.outlet_ids  : [],
      valid_from:  p.valid_from,
      valid_until: p.valid_until,
      day_of_week: Array.isArray(p.day_of_week) ? p.day_of_week : [],
      time_start:  p.time_start,
      time_end:    p.time_end,
      priority:    p.priority ?? 0,
    }));
}

/** Is this combo currently eligible given outlet + day + time-of-day?
 *  Mirrors the loyalty evaluator's `isPromoEligible` checks. */
export function isComboLiveNow(c: ComboPromotion, outletId: string | null, now: Date = new Date()): boolean {
  if (c.valid_from && new Date(c.valid_from) > now) return false;
  if (c.valid_until && new Date(c.valid_until) < now) return false;
  if (c.day_of_week.length > 0 && !c.day_of_week.includes(now.getDay())) return false;
  if (c.time_start && c.time_end) {
    // MYT "HH:MM" strings compared against the device's local time —
    // assumes the device is in MYT, which is the case for all Celsius
    // customers. We don't normalise via timezone math here because
    // doing so on every keystroke is expensive; the server re-checks
    // at checkout with strict accuracy.
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const cur = `${hh}:${mm}`;
    if (cur < c.time_start || cur > c.time_end) return false;
  }
  if (c.outlet_ids.length > 0 && (!outletId || !c.outlet_ids.includes(outletId))) return false;
  return true;
}

/** Estimate the customer-facing savings for combining `current` with
 *  a candidate `pair` product. Returns null when no combo applies.
 *
 *  Matches the loyalty evaluator's discount math closely enough that
 *  the preview lines up with what the server bills — the actual
 *  authority is still the server.
 */
export function bestComboForPair(args: {
  combos: ComboPromotion[];
  currentProductId: string;
  currentProductCategory: string;
  currentProductPrice: number;
  pairProductId: string;
  pairProductCategory: string;
  pairProductPrice: number;
  outletId: string | null;
  now?: Date;
}): { combo: ComboPromotion; savings: number } | null {
  const now = args.now ?? new Date();
  let best: { combo: ComboPromotion; savings: number } | null = null;

  for (const c of args.combos) {
    if (!isComboLiveNow(c, args.outletId, now)) continue;

    // Gate check — both gates must be satisfied by the (current + pair)
    // pair specifically. The pickup-native preview only knows about
    // these two items, not the entire cart, so it can't predict a
    // 3-product combo gate. That's a feature-not-bug: we should only
    // promise savings we can deliver from this specific pairing.
    const productSet  = new Set([args.currentProductId, args.pairProductId]);
    const categorySet = new Set([args.currentProductCategory, args.pairProductCategory]);

    if (c.combo_product_ids.length > 0) {
      const allInPair = c.combo_product_ids.every((id) => productSet.has(id));
      if (!allInPair) continue;
    }
    if (c.combo_category_ids.length > 0) {
      const allInPair = c.combo_category_ids.every((cat) => categorySet.has(cat));
      if (!allInPair) continue;
    }
    // If neither gate is set the combo isn't really a combo for our
    // purposes — skip.
    if (c.combo_product_ids.length === 0 && c.combo_category_ids.length === 0) continue;

    // Bundle subtotal = the two items' prices (one unit each).
    const bundleSubtotal = args.currentProductPrice + args.pairProductPrice;

    // Compute savings by discount_type.
    let savings = 0;
    switch (c.discount_type) {
      case "combo_price":
        if (c.combo_price != null) savings = Math.max(0, bundleSubtotal - c.combo_price);
        break;
      case "fixed_amount_off":
        savings = Math.min(bundleSubtotal, c.discount_value ?? 0);
        break;
      case "percentage_off": {
        const pct = (c.discount_value ?? 0) / 100;
        savings = bundleSubtotal * pct;
        if (c.max_discount_value != null) savings = Math.min(savings, c.max_discount_value);
        break;
      }
      case "free_item":
        savings = Math.min(args.currentProductPrice, args.pairProductPrice);
        break;
      case "override_price":
        if (c.override_price != null) {
          savings = Math.max(0, bundleSubtotal - c.override_price * 2);
        }
        break;
      default:
        savings = 0;
    }
    savings = Math.max(0, Math.round(savings * 100) / 100);
    if (savings <= 0) continue;
    if (!best || savings > best.savings) best = { combo: c, savings };
  }

  return best;
}
