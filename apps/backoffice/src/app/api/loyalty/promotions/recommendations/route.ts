import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

/**
 * Combo recommendation API. Surfaces "AI-mined" combo suggestions
 * based on real POS basket history, scoped to the 7 sales rounds.
 *
 *   GET   → list recommendations
 *   POST  → apply one (creates an active combo promo wired to that
 *           round's time window + the recommended categories)
 *
 * The actual mining happens in the get_combo_recommendations() SQL
 * function — keeps the per-round basket aggregation in the database
 * where it belongs (avoids shuttling 20k rows to the Node layer).
 */

type Recommendation = {
  round_key: string;
  round_label: string;
  category_a: string;
  category_b: string;
  category_a_label: string | null;
  category_b_label: string | null;
  basket_count: number;
  avg_basket_value: string;     // numeric returned as string by PostgREST
  round_avg_basket_value: string;
  uplift_rm: string;
  example_product_a: string | null;
  example_product_b: string | null;
  already_has_combo: boolean;
};

const ROUND_WINDOWS: Record<string, { start: string; end: string }> = {
  breakfast: { start: "08:00", end: "10:00" },
  brunch:    { start: "10:00", end: "12:00" },
  lunch:     { start: "12:00", end: "15:00" },
  midday:    { start: "15:00", end: "17:00" },
  evening:   { start: "17:00", end: "19:00" },
  dinner:    { start: "19:00", end: "21:00" },
  supper:    { start: "21:00", end: "23:00" },
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const minBaskets = Math.max(5, Number(url.searchParams.get("min_baskets") ?? 30));
  const maxPerRound = Math.max(1, Math.min(10, Number(url.searchParams.get("max_per_round") ?? 3)));

  const { data, error } = await supabaseAdmin.rpc("get_combo_recommendations", {
    min_baskets: minBaskets,
    max_per_round: maxPerRound,
  });
  if (error) {
    console.error("[recommendations]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return only un-applied recommendations by default — admins
  // primarily care about "what's NEW to set up". Pass ?include_existing=1
  // to see the full list including pairs already covered by an
  // active promo.
  const includeExisting = url.searchParams.get("include_existing") === "1";
  const filtered = (data as Recommendation[] | null ?? []).filter(
    (r) => includeExisting || !r.already_has_combo,
  );

  return NextResponse.json({
    recommendations: filtered,
    total: filtered.length,
    excluded_existing: !includeExisting,
  });
}

/**
 * POST body:
 * {
 *   round_key: "breakfast",
 *   category_a: "classic",
 *   category_b: "sandwiches",
 *   discount_value: 2.00,            // RM off
 *   name_override?: string,           // optional, defaults to auto-generated
 * }
 *
 * Creates an `auto-apply, fixed_amount_off` combo gated by the two
 * categories AND the round's time window.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const round_key: string = body.round_key;
    const category_a: string = body.category_a;
    const category_b: string = body.category_b;
    const discount_value: number = Number(body.discount_value ?? 2);
    const window = ROUND_WINDOWS[round_key];
    if (!window) {
      return NextResponse.json({ error: `Unknown round_key: ${round_key}` }, { status: 400 });
    }
    if (!category_a || !category_b || category_a === category_b) {
      return NextResponse.json({ error: "Two distinct categories required" }, { status: 400 });
    }

    // Auto-name based on category labels + round label.
    const labelByCategory = await (async () => {
      const { data } = await supabaseAdmin
        .from("categories")
        .select("id, name")
        .in("id", [category_a, category_b]);
      const m = new Map<string, string>();
      for (const c of (data ?? []) as Array<{ id: string; name: string }>) m.set(c.id, c.name);
      return m;
    })();
    const labelA = labelByCategory.get(category_a) ?? category_a;
    const labelB = labelByCategory.get(category_b) ?? category_b;
    const roundLabel = round_key.charAt(0).toUpperCase() + round_key.slice(1);
    const autoName = body.name_override?.trim() ||
      `${labelA} + ${labelB} — RM${discount_value.toFixed(2)} off (${roundLabel})`;

    // Stable ID so re-applying the same recommendation is idempotent
    // (lands on UPSERT instead of creating duplicates).
    const id = `combo-${round_key}-${[category_a, category_b].sort().join("-")}`;

    const { data, error } = await supabaseAdmin
      .from("promotions")
      .upsert({
        id,
        brand_id: "brand-celsius",
        name: autoName,
        description:
          `Auto-recommended from POS data. Customers in ${roundLabel} ` +
          `frequently order ${labelA} + ${labelB} — encourage with RM${discount_value.toFixed(2)} off.`,
        trigger_type: "auto",
        discount_type: "fixed_amount_off",
        discount_value,
        combo_category_ids: [category_a, category_b],
        combo_product_ids: [],
        applicable_products: [],
        applicable_categories: [],
        applicable_tags: [],
        eligible_member_tags: [],
        outlet_ids: [],
        free_product_ids: [],
        day_of_week: [],
        time_start: window.start,
        time_end: window.end,
        stackable: true,
        is_active: true,
        priority: 10,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, promotion: data });
  } catch (err) {
    console.error("[recommendations apply]", err);
    return NextResponse.json({ error: "Failed to apply recommendation" }, { status: 500 });
  }
}
