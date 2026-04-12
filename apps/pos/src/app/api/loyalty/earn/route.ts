import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BRAND_ID = "brand-celsius";

/**
 * POST /api/loyalty/earn
 * Body: { member_id, outlet_id, amount_rm, order_id, order_number }
 *
 * Awards loyalty points based on order total.
 * Points = floor(amount_rm * points_per_rm)
 * Respects daily earning limit from brand settings.
 */
export async function POST(req: NextRequest) {
  try {
    const { member_id, outlet_id, amount_rm, order_id, order_number } = await req.json();

    if (!member_id || !outlet_id || !amount_rm) {
      return NextResponse.json({ error: "member_id, outlet_id, amount_rm required" }, { status: 400 });
    }

    if (amount_rm <= 0) {
      return NextResponse.json({ error: "amount_rm must be positive" }, { status: 400 });
    }

    // Get brand config for points_per_rm and daily limit
    const { data: brand } = await supabase
      .from("brands")
      .select("points_per_rm, daily_earning_limit")
      .eq("id", BRAND_ID)
      .single();

    const pointsPerRm = Number(brand?.points_per_rm ?? 1);
    const dailyLimit = brand?.daily_earning_limit ?? 0; // 0 = unlimited

    // Calculate points to award
    const points = Math.floor(amount_rm * pointsPerRm);
    if (points <= 0) {
      return NextResponse.json({ success: true, points_earned: 0, reason: "Order too small" });
    }

    // Check daily earning limit
    if (dailyLimit > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("point_transactions")
        .select("*", { count: "exact", head: true })
        .eq("member_id", member_id)
        .eq("brand_id", BRAND_ID)
        .eq("type", "earn")
        .gte("created_at", todayStart.toISOString());

      if (count !== null && count >= dailyLimit) {
        return NextResponse.json({
          success: true,
          points_earned: 0,
          reason: "Daily earning limit reached",
        });
      }
    }

    // Get current member_brands record
    const { data: mb, error: mbErr } = await supabase
      .from("member_brands")
      .select("*")
      .eq("member_id", member_id)
      .eq("brand_id", BRAND_ID)
      .single();

    if (mbErr || !mb) {
      return NextResponse.json({ error: "Member not found for this brand" }, { status: 404 });
    }

    const newBalance = mb.points_balance + points;

    // Update balance (optimistic concurrency)
    const { data: updated, error: updateErr } = await supabase
      .from("member_brands")
      .update({
        points_balance: newBalance,
        total_points_earned: mb.total_points_earned + points,
        total_visits: mb.total_visits + 1,
        total_spent: mb.total_spent + amount_rm,
        last_visit_at: new Date().toISOString(),
      })
      .eq("id", mb.id)
      .eq("points_balance", mb.points_balance) // optimistic lock
      .select()
      .single();

    if (updateErr || !updated) {
      // Retry once on concurrency conflict
      const { data: mb2 } = await supabase
        .from("member_brands")
        .select("*")
        .eq("member_id", member_id)
        .eq("brand_id", BRAND_ID)
        .single();

      if (!mb2) return NextResponse.json({ error: "Concurrency error" }, { status: 409 });

      const newBalance2 = mb2.points_balance + points;
      await supabase
        .from("member_brands")
        .update({
          points_balance: newBalance2,
          total_points_earned: mb2.total_points_earned + points,
          total_visits: mb2.total_visits + 1,
          total_spent: mb2.total_spent + amount_rm,
          last_visit_at: new Date().toISOString(),
        })
        .eq("id", mb2.id);
    }

    // Update preferred outlet
    await supabase
      .from("members")
      .update({ preferred_outlet_id: outlet_id })
      .eq("id", member_id);

    // Create audit trail
    const txnId = `txn-pos-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    await supabase.from("point_transactions").insert({
      id: txnId,
      member_id,
      brand_id: BRAND_ID,
      outlet_id,
      type: "earn",
      points,
      balance_after: (updated ? newBalance : (mb.points_balance + points)),
      description: `POS Order ${order_number ?? order_id ?? ""}`.trim(),
      reference_id: order_id || null,
      multiplier: 1,
    });

    return NextResponse.json({
      success: true,
      points_earned: points,
      new_balance: updated ? newBalance : (mb.points_balance + points),
    });
  } catch (err) {
    console.error("[LOYALTY] Earn points error:", err);
    return NextResponse.json({ error: "Failed to award points" }, { status: 500 });
  }
}
