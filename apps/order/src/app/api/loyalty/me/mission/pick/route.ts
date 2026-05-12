// POST /api/loyalty/me/mission/pick — lock in a mission for the current week.
// Body: { mission_id: string }
//
// Computes Mon 00:00–Sun 23:59 in Asia/Kuala_Lumpur (customer local).
// Cancels any existing active assignment for the same week before
// inserting, so customers can swap freely until the week ends.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

const BRAND_ID = (process.env.LOYALTY_BRAND_ID ?? "brand-celsius").trim();

// Customer is in Asia/Kuala_Lumpur (UTC+8). Compute Monday 00:00 +08:00
// as the week_start, Sunday 23:59:59 +08:00 as the week_end. Keeping
// the offset explicit avoids server-time drift between regions.
const MY_OFFSET_HOURS = 8;
function currentWeekWindow(now = new Date()): { startIso: string; endIso: string } {
  // Shift to UTC+8 wall-clock time.
  const my = new Date(now.getTime() + MY_OFFSET_HOURS * 60 * 60 * 1000);
  const day = my.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const daysFromMonday = (day + 6) % 7; // Mon → 0, Sun → 6
  const monMidnight = new Date(my);
  monMidnight.setUTCDate(my.getUTCDate() - daysFromMonday);
  monMidnight.setUTCHours(0, 0, 0, 0);
  const sunEnd = new Date(monMidnight);
  sunEnd.setUTCDate(monMidnight.getUTCDate() + 6);
  sunEnd.setUTCHours(23, 59, 59, 999);
  // Shift back to UTC.
  const startUtc = new Date(monMidnight.getTime() - MY_OFFSET_HOURS * 60 * 60 * 1000);
  const endUtc = new Date(sunEnd.getTime() - MY_OFFSET_HOURS * 60 * 60 * 1000);
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString() };
}

export async function POST(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const body = await req.json().catch(() => null);
  const missionId = body?.mission_id as string | undefined;
  if (!missionId) {
    return NextResponse.json({ error: "mission_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: mission } = await supabase
    .from("reward_missions")
    .select("id, goal, title, description, icon, difficulty")
    .eq("id", missionId)
    .eq("brand_id", BRAND_ID)
    .eq("is_active", true)
    .single();

  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  const target = (mission.goal as { threshold?: number })?.threshold ?? 1;
  const { startIso, endIso } = currentWeekWindow();

  // Mark any existing active assignment as 'swapped' so the new pick
  // becomes the canonical one. Customers can swap unlimited times until
  // the week ends (intentional soft lock-in).
  await supabase
    .from("mission_assignments")
    .update({ status: "swapped" })
    .eq("member_id", r.member.memberId)
    .eq("status", "active");

  const { data: inserted, error } = await supabase
    .from("mission_assignments")
    .insert({
      member_id: r.member.memberId,
      mission_id: mission.id,
      week_start_at: startIso,
      week_end_at: endIso,
      progress_current: 0,
      progress_target: target,
      status: "active",
    })
    .select()
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // Increment the picked counter on the mission (analytics). Best-effort.
  try {
    await supabase.rpc("increment_mission_picked", { mission_id_param: mission.id });
  } catch { /* analytics bump is non-critical */ }

  return NextResponse.json({
    assignment_id: inserted.id,
    id: mission.id,
    title: mission.title,
    description: mission.description,
    icon: mission.icon,
    difficulty: mission.difficulty,
    goal_threshold: target,
    reward_summary: "Bonus rewards", // client refetches with full details
    progress_current: 0,
    status: "active",
    week_end_at: endIso,
    completed_at: null,
  });
}
