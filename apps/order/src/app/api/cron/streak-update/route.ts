export const dynamic = "force-dynamic";

// Nightly: increment or burn weekly streaks.
//
// Logic (run once daily at e.g. 02:00 MYT):
//   For each member with an order in the past 7 days → ensure their
//   streak reflects the current week's order. If they ordered THIS
//   week and haven't been bumped, increment current_streak_weeks.
//
//   On the first day of a new week (Monday MYT), check anyone whose
//   last_order_week_start is older than 2 weeks ago: burn their
//   streak unless they have a saver available — then consume the saver
//   instead.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkCronAuth } from "@celsius/shared";

const MY_OFFSET_HOURS = 8;

function thisWeekStartIso(now = new Date()): string {
  const my = new Date(now.getTime() + MY_OFFSET_HOURS * 60 * 60 * 1000);
  const daysFromMonday = (my.getUTCDay() + 6) % 7;
  const mon = new Date(my);
  mon.setUTCDate(my.getUTCDate() - daysFromMonday);
  mon.setUTCHours(0, 0, 0, 0);
  return new Date(mon.getTime() - MY_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
}

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(req.headers);
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });

  const supabase = getSupabaseAdmin();
  const weekStart = thisWeekStartIso();
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Members with a paid order this week → bump streak if not already bumped.
  const { data: ordering } = await supabase
    .from("orders")
    .select("loyalty_id")
    .gte("created_at", weekStart)
    .in("status", ["preparing", "ready", "completed"])
    .not("loyalty_id", "is", null);

  const uniqueMembers = Array.from(new Set((ordering ?? []).map((o) => o.loyalty_id as string)));

  let bumped = 0;
  for (const memberId of uniqueMembers) {
    const { data: existing } = await supabase
      .from("user_streaks")
      .select("current_streak_weeks, longest_streak_weeks, last_order_week_start")
      .eq("member_id", memberId)
      .single();

    if (existing && existing.last_order_week_start === weekStart) continue; // already counted

    const newCurrent = (existing?.current_streak_weeks ?? 0) + 1;
    const newLongest = Math.max(existing?.longest_streak_weeks ?? 0, newCurrent);

    await supabase.from("user_streaks").upsert({
      member_id: memberId,
      current_streak_weeks: newCurrent,
      longest_streak_weeks: newLongest,
      last_order_week_start: weekStart,
    });
    bumped++;
  }

  // 2) Lapsed members (last order > 2 weeks ago) — burn streak or saver.
  const { data: lapsed } = await supabase
    .from("user_streaks")
    .select("member_id, current_streak_weeks, saver_available, last_order_week_start")
    .lt("last_order_week_start", twoWeeksAgo)
    .gt("current_streak_weeks", 0);

  let burned = 0;
  let saved = 0;
  for (const s of lapsed ?? []) {
    if (s.saver_available) {
      await supabase.from("user_streaks").update({
        saver_available: false,
        saver_last_used_at: new Date().toISOString(),
      }).eq("member_id", s.member_id);
      saved++;
    } else {
      await supabase.from("user_streaks").update({
        current_streak_weeks: 0,
      }).eq("member_id", s.member_id);
      burned++;
    }
  }

  return NextResponse.json({
    week_start: weekStart,
    bumped,
    burned,
    saved,
  });
}
