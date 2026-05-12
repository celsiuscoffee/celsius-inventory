// GET /api/loyalty/me/vouchers — caller's voucher wallet (active + recent).
//
// Returns issued_rewards rows for the authenticated member, sorted by
// expiry (soonest first), with status filter open so the client can show
// active / redeemed / expired in one trip if it wants.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

export async function GET(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("issued_rewards")
    .select(`
      id, voucher_template_id, source_type,
      title, description, icon, category,
      status, issued_at, expires_at, redeemed_at,
      stacks_with_beans,
      discount_type, discount_value, min_order_value,
      applicable_categories, applicable_products, free_product_name
    `)
    .eq("member_id", r.member.memberId)
    .in("status", ["active"])
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const out = (data ?? []).map((v) => ({
    id: v.id,
    template_id: v.voucher_template_id ?? null,
    title: v.title ?? "Voucher",
    description: v.description ?? "",
    icon: v.icon ?? "ticket",
    category: v.category ?? "special",
    status: v.status,
    source_type: v.source_type ?? null,
    issued_at: v.issued_at,
    expires_at: v.expires_at,
    redeemed_at: v.redeemed_at,
    stacks_with_beans: v.stacks_with_beans ?? true,
    // Discount metadata for the client-side discount engine.
    discount_type:         v.discount_type ?? null,
    discount_value:        v.discount_value ?? null,
    min_order_value:       v.min_order_value ?? null,
    applicable_categories: v.applicable_categories ?? null,
    applicable_products:   v.applicable_products ?? null,
    free_product_name:     v.free_product_name ?? null,
  }));

  return NextResponse.json(out);
}
