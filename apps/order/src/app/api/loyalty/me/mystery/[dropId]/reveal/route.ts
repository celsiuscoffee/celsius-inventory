// POST /api/loyalty/me/mystery/[dropId]/reveal — flip a mystery drop
// to revealed and apply its effect (bean multiplier / flat / voucher).
//
// Body: { base_beans_earned?: number } — optional base for multiplier
// math. If omitted we look up the order_id's loyalty_points_earned.

import { NextRequest, NextResponse } from "next/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";
import { revealMysteryDrop } from "@/lib/loyalty/v2";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ dropId: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { dropId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  let baseBeansEarned = typeof body?.base_beans_earned === "number" ? body.base_beans_earned : null;

  // If client didn't pass the base, fetch from the drop's order so we
  // can do the multiplier math server-side.
  if (baseBeansEarned === null) {
    const supabase = getSupabaseAdmin();
    const { data: drop } = await supabase
      .from("mystery_drops")
      .select("order_id")
      .eq("id", dropId)
      .eq("member_id", r.member.memberId)
      .single();
    if (drop?.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("loyalty_points_earned")
        .eq("id", drop.order_id)
        .single();
      baseBeansEarned = (order?.loyalty_points_earned as number) ?? 0;
    } else {
      baseBeansEarned = 0;
    }
  }

  const result = await revealMysteryDrop({
    memberId: r.member.memberId,
    dropId,
    baseBeansEarned: baseBeansEarned ?? 0,
  });

  if (!result) return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  return NextResponse.json(result);
}
