// GET /api/loyalty/me/vouchers/[id] — single voucher detail.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { id } = await ctx.params;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("issued_rewards")
    .select(`
      id, voucher_template_id, source_type,
      title, description, icon, category,
      status, issued_at, expires_at, redeemed_at,
      stacks_with_beans
    `)
    .eq("id", id)
    .eq("member_id", r.member.memberId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    template_id: data.voucher_template_id ?? null,
    title: data.title ?? "Voucher",
    description: data.description ?? "",
    icon: data.icon ?? "ticket",
    category: data.category ?? "special",
    status: data.status,
    source_type: data.source_type ?? null,
    issued_at: data.issued_at,
    expires_at: data.expires_at,
    redeemed_at: data.redeemed_at,
    stacks_with_beans: data.stacks_with_beans ?? true,
  });
}
