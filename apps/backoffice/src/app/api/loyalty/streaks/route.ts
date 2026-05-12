// Read-only dashboard endpoint — top streaks across the brand.
//
// Returns aggregate stats: count of active streakers (current > 0),
// longest streak overall, and the leaderboard. No per-customer mutation
// — streaks are maintained by the order app's nightly cron.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { data: rows } = await supabaseAdmin
    .from("user_streaks")
    .select("member_id, current_streak_weeks, longest_streak_weeks, last_order_week_start, saver_available")
    .order("current_streak_weeks", { ascending: false })
    .limit(100);

  const all = rows ?? [];
  const activeStreakers = all.filter((s) => (s.current_streak_weeks as number) > 0).length;
  const longest = all.reduce((max, s) => Math.max(max, (s.longest_streak_weeks as number) ?? 0), 0);
  const saversAvailable = all.filter((s) => s.saver_available).length;

  return NextResponse.json({
    summary: {
      active_streakers: activeStreakers,
      longest_streak_weeks: longest,
      savers_available: saversAvailable,
      total_tracked: all.length,
    },
    leaderboard: all.slice(0, 50),
  });
}
