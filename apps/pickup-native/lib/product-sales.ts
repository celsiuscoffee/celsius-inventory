import { supabase } from "./supabase";

/**
 * Sale-price discovery for the customer side. Mirrors the loyalty
 * evaluator's eligibility logic just enough to compute the effective
 * price a customer should see on the menu RIGHT NOW — strikethrough
 * the original, show the discounted price.
 *
 * What counts as a "sale" for this surface:
 *   - trigger_type = 'auto' (always-on, no code needed)
 *   - discount_type in ('percentage_off', 'fixed_amount_off')
 *   - applicable_products OR applicable_categories non-empty
 *     (otherwise the discount is cart-wide and would show on every
 *     menu row — visual noise)
 *   - NO combo gate (combo_product_ids / combo_category_ids empty) —
 *     combos surface via PairWith's "Save RMx" badge instead
 *   - Currently within valid window (date + day + time, MYT-aware)
 *
 * Skipped on purpose:
 *   - first_order, tier_perk, code, reward_link triggers — those are
 *     personalised / contextual and don't belong as a public sale
 *     price on the menu.
 *
 * The server is still the authority — checkout re-evaluates and the
 * order POST re-evaluates again. This preview is for displaying the
 * deal so the customer sees the value before tapping the product.
 */

export type ProductSale = {
  promotion_id: string;
  promotion_name: string;
  discount_type: "percentage_off" | "fixed_amount_off";
  discount_value: number;            // % or RM depending on type
  max_discount_value: number | null; // cap on percentage_off
  applicable_products: string[];
  applicable_categories: string[];
  time_start: string | null;
  time_end: string | null;
  day_of_week: number[];
  valid_from: string | null;
  valid_until: string | null;
  outlet_ids: string[];
  priority: number;
};

/** Pull every active sale-shaped promotion. Filtered server-side to
 *  the discount types we care about; eligibility (time, outlet) is
 *  re-checked client-side per product. */
export async function fetchActiveSales(): Promise<ProductSale[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(
      "id, name, trigger_type, discount_type, discount_value, max_discount_value, applicable_products, applicable_categories, combo_product_ids, combo_category_ids, time_start, time_end, day_of_week, valid_from, valid_until, outlet_ids, priority, is_active",
    )
    .eq("brand_id", "brand-celsius")
    .eq("is_active", true)
    .eq("trigger_type", "auto")
    .in("discount_type", ["percentage_off", "fixed_amount_off"]);
  if (error) {
    console.warn("[product-sales] fetch failed", error);
    return [];
  }
  return (data ?? [])
    .filter((p) => {
      const hasCombo  = (p.combo_product_ids?.length  ?? 0) > 0 || (p.combo_category_ids?.length ?? 0) > 0;
      const hasScope  = (p.applicable_products?.length ?? 0) > 0 || (p.applicable_categories?.length ?? 0) > 0;
      // No combo gate (combos have their own UI). MUST have a product
      // or category scope; otherwise the sale is cart-wide and would
      // light up every single row in the menu.
      return !hasCombo && hasScope && p.discount_value != null;
    })
    .map((p) => ({
      promotion_id:           p.id,
      promotion_name:         p.name,
      discount_type:          p.discount_type as ProductSale["discount_type"],
      discount_value:         Number(p.discount_value),
      max_discount_value:     p.max_discount_value == null ? null : Number(p.max_discount_value),
      applicable_products:    Array.isArray(p.applicable_products)   ? p.applicable_products   : [],
      applicable_categories:  Array.isArray(p.applicable_categories) ? p.applicable_categories : [],
      time_start:             p.time_start,
      time_end:               p.time_end,
      day_of_week:            Array.isArray(p.day_of_week) ? p.day_of_week : [],
      valid_from:             p.valid_from,
      valid_until:            p.valid_until,
      outlet_ids:             Array.isArray(p.outlet_ids) ? p.outlet_ids : [],
      priority:               p.priority ?? 0,
    }));
}

/** Is this sale currently eligible given outlet + day + time (MYT)? */
export function isSaleLiveNow(s: ProductSale, outletId: string | null, now: Date = new Date()): boolean {
  if (s.valid_from && new Date(s.valid_from) > now) return false;
  if (s.valid_until && new Date(s.valid_until) < now) return false;
  // Day + time-of-day comparisons in MYT (UTC+8, no DST).
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  if (s.day_of_week.length > 0 && !s.day_of_week.includes(myt.getUTCDay())) return false;
  if (s.time_start && s.time_end) {
    const hh = String(myt.getUTCHours()).padStart(2, "0");
    const mm = String(myt.getUTCMinutes()).padStart(2, "0");
    const cur = `${hh}:${mm}:00`;
    if (cur < s.time_start || cur > s.time_end) return false;
  }
  if (s.outlet_ids.length > 0 && (!outletId || !s.outlet_ids.includes(outletId))) return false;
  return true;
}

export type SaleResult = {
  sale: ProductSale;
  /** RM saved off the base price (per single unit, ignoring qty). */
  savings: number;
  /** Effective price after the sale. */
  effective_price: number;
};

/** Best sale price for the given product, or null if none apply.
 *  Highest savings wins when multiple promos are eligible. */
export function bestSaleForProduct(args: {
  sales: ProductSale[];
  productId: string;
  productCategory: string;
  productBasePrice: number;
  outletId: string | null;
  now?: Date;
}): SaleResult | null {
  const { sales, productId, productCategory, productBasePrice, outletId, now } = args;
  let best: SaleResult | null = null;
  for (const s of sales) {
    if (!isSaleLiveNow(s, outletId, now)) continue;
    // Match by product OR category.
    const matchesProduct  = s.applicable_products.includes(productId);
    const matchesCategory = s.applicable_categories.includes(productCategory);
    if (!matchesProduct && !matchesCategory) continue;
    // Compute the saving.
    let savings = 0;
    if (s.discount_type === "percentage_off") {
      savings = productBasePrice * (s.discount_value / 100);
      if (s.max_discount_value != null) savings = Math.min(savings, s.max_discount_value);
    } else {
      // fixed_amount_off — applied per line item, capped at base price.
      savings = Math.min(productBasePrice, s.discount_value);
    }
    savings = Math.max(0, Math.round(savings * 100) / 100);
    if (savings <= 0) continue;
    const effective = Math.max(0, Math.round((productBasePrice - savings) * 100) / 100);
    if (!best || savings > best.savings) {
      best = { sale: s, savings, effective_price: effective };
    }
  }
  return best;
}
