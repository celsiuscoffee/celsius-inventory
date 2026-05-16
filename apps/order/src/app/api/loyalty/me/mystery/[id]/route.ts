// GET /api/loyalty/me/mystery/[orderId] — pending mystery drop for an order.
//
// The order confirmation screen calls this after payment success. If a
// drop was generated for this order and not yet revealed, returns its id
// so the client renders the scratch card. Otherwise null.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { id: orderId } = await ctx.params;

  const supabase = getSupabaseAdmin();
  const { data: drop } = await supabase
    .from("mystery_drops")
    .select("id, revealed_at")
    .eq("member_id", r.member.memberId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!drop) return NextResponse.json(null);

  return NextResponse.json({
    drop_id: drop.id,
    order_id: orderId,
    revealed: !!drop.revealed_at,
  });
}
