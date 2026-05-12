// GET /api/loyalty/me/streak — caller's weekly visit streak.
// Returns null if no streak row exists yet (new customer).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

export async function GET(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_streaks")
    .select("current_streak_weeks, longest_streak_weeks, last_order_week_start, saver_available")
    .eq("member_id", r.member.memberId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({
      current_streak_weeks: 0,
      longest_streak_weeks: 0,
      last_order_week_start: null,
      saver_available: true,
    });
  }
  return NextResponse.json(data);
}
