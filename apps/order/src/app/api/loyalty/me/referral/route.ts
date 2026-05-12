// GET /api/loyalty/me/referral — get-or-create the caller's referral code
// and stats (total successful referrals).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";
import { getOrCreateReferralCode } from "@/lib/loyalty/v2";

export async function GET(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const code = await getOrCreateReferralCode(r.member.memberId);
  if (!code) return NextResponse.json({ error: "Failed to mint code" }, { status: 500 });

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("referral_codes")
    .select("total_referred")
    .eq("member_id", r.member.memberId)
    .single();

  // Also fetch attribution detail for the "your referrals" list.
  const { data: attrs } = await supabase
    .from("referral_attributions")
    .select("status, created_at, rewarded_at")
    .eq("referrer_id", r.member.memberId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    code,
    total_referred: row?.total_referred ?? 0,
    pending: (attrs ?? []).filter((a) => a.status === "pending").length,
    rewarded: (attrs ?? []).filter((a) => a.status === "rewarded").length,
    recent: attrs ?? [],
  });
}
