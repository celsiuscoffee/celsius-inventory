import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BRAND_ID = "brand-celsius";

/**
 * GET /api/loyalty/rewards?member_id=xxx
 *
 * Returns available rewards for a member:
 * 1. Catalog rewards they can afford (points_required <= balance)
 * 2. Issued rewards (birthday, welcome) that are still active
 */
export async function GET(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get("member_id");
    if (!memberId) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    // Fetch member balance
    const { data: mb } = await supabase
      .from("member_brands")
      .select("points_balance")
      .eq("member_id", memberId)
      .eq("brand_id", BRAND_ID)
      .single();

    const balance = mb?.points_balance ?? 0;

    // Fetch catalog rewards (active, in_store or null fulfillment)
    const { data: catalogRewards } = await supabase
      .from("rewards")
      .select("id, name, description, points_required, discount_type, discount_value, max_discount_value, free_product_name, free_product_ids, image_url, stock, reward_type, applicable_categories, applicable_products")
      .eq("brand_id", BRAND_ID)
      .eq("is_active", true)
      .order("points_required", { ascending: true });

    // Fetch issued rewards (birthday, welcome, etc.) that are active and not expired
    const { data: issuedRewards } = await supabase
      .from("issued_rewards")
      .select("id, reward_id, status, expires_at, code")
      .eq("member_id", memberId)
      .eq("brand_id", BRAND_ID)
      .eq("status", "active");

    // Filter catalog rewards: affordable ones
    const affordable = (catalogRewards ?? []).filter((r) => {
      if (r.stock !== null && r.stock <= 0) return false;
      return r.points_required <= balance;
    });

    // Map issued rewards with their reward details
    const issuedWithDetails = (issuedRewards ?? []).filter((ir) => {
      if (ir.expires_at && new Date(ir.expires_at) < new Date()) return false;
      return true;
    }).map((ir) => {
      const reward = (catalogRewards ?? []).find((r) => r.id === ir.reward_id);
      return {
        issued_reward_id: ir.id,
        code: ir.code,
        expires_at: ir.expires_at,
        is_issued: true,
        points_required: 0, // Already issued — free to use
        ...reward,
      };
    });

    return NextResponse.json({
      balance,
      catalog: affordable,
      issued: issuedWithDetails,
    });
  } catch (err) {
    console.error("[LOYALTY] Fetch rewards error:", err);
    return NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
  }
}
