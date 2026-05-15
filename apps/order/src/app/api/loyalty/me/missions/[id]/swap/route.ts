// POST /api/loyalty/me/missions/[id]/swap
//
// Confirms a challenge swap. Atomic-ish flow:
//   1. Validate the assignment is the caller's, active, and on a
//      swap-eligible mission.
//   2. Validate the target mission_id is itself swap-eligible + not
//      already assigned to the member this week.
//   3. INSERT into mission_swap_history. The unique index
//      (member_id, week_start_at) is the cap enforcer — if a parallel
//      request slips through validation, the insert raises and the
//      assignment update never fires.
//   4. UPDATE mission_assignments: change mission_id, reset progress
//      to 0, refresh progress_target from the new mission's threshold.
//
// Returns the updated assignment shape so the client can splice it
// straight into the active-missions cache. The frontend should also
// invalidate any cached reward_summary that included the old mission.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

const BRAND_ID = (process.env.LOYALTY_BRAND_ID ?? "brand-celsius").trim();

type Goal = { type?: string; threshold?: number } | null;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { id: assignmentId } = await params;
  const supabase = getSupabaseAdmin();

  const body = await req.json().catch(() => null);
  const toMissionId =
    body && typeof body.to_mission_id === "string" ? (body.to_mission_id as string) : null;
  if (!toMissionId) {
    return NextResponse.json({ error: "to_mission_id_required" }, { status: 400 });
  }

  // 1) Load assignment + its (current) mission row.
  const { data: assignment } = await supabase
    .from("mission_assignments")
    .select(`
      id, member_id, mission_id, status, week_start_at, week_end_at,
      reward_missions!inner(id, is_swap_eligible)
    `)
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.member_id !== r.member.memberId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (assignment.status !== "active") {
    return NextResponse.json({ error: "assignment_not_active" }, { status: 409 });
  }
  const rawMission = assignment.reward_missions as
    | { is_swap_eligible: boolean }
    | { is_swap_eligible: boolean }[]
    | null;
  const fromMissionMeta = Array.isArray(rawMission) ? rawMission[0] : rawMission;
  if (!fromMissionMeta?.is_swap_eligible) {
    return NextResponse.json({ error: "mission_not_swap_eligible" }, { status: 409 });
  }

  // Can't swap to the same mission you already have.
  if (toMissionId === assignment.mission_id) {
    return NextResponse.json({ error: "same_mission" }, { status: 400 });
  }

  // 2) Load + validate the target mission.
  const { data: target } = await supabase
    .from("reward_missions")
    .select(
      "id, brand_id, is_active, is_swap_eligible, goal, starts_at, ends_at",
    )
    .eq("id", toMissionId)
    .maybeSingle();
  if (!target || target.brand_id !== BRAND_ID) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }
  if (!target.is_active || !target.is_swap_eligible) {
    return NextResponse.json({ error: "target_not_eligible" }, { status: 409 });
  }
  const now = Date.now();
  if (target.starts_at && new Date(target.starts_at).getTime() > now) {
    return NextResponse.json({ error: "target_not_started" }, { status: 409 });
  }
  if (target.ends_at && new Date(target.ends_at).getTime() < now) {
    return NextResponse.json({ error: "target_ended" }, { status: 409 });
  }

  // 3) Target mustn't already be in the member's active set this week.
  const { data: dupe } = await supabase
    .from("mission_assignments")
    .select("id")
    .eq("member_id", r.member.memberId)
    .eq("week_start_at", assignment.week_start_at)
    .eq("mission_id", toMissionId)
    .maybeSingle();
  if (dupe) {
    return NextResponse.json({ error: "target_already_assigned" }, { status: 409 });
  }

  // 4) Insert the swap-history row. Unique index on
  //    (member_id, week_start_at) blocks a second swap in the same
  //    week with a 23505 error — translate to a clean 429.
  const { error: insertErr } = await supabase
    .from("mission_swap_history")
    .insert({
      member_id: r.member.memberId,
      week_start_at: assignment.week_start_at,
      assignment_id: assignmentId,
      from_mission_id: assignment.mission_id,
      to_mission_id: toMissionId,
    });
  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "already_swapped_this_week" }, { status: 429 });
    }
    return NextResponse.json(
      { error: "swap_failed", detail: insertErr.message },
      { status: 500 },
    );
  }

  // 5) Update the assignment in place. Reset progress so the customer
  //    starts fresh on the new challenge — half-progress carried over
  //    from a different goal type would be meaningless.
  const newTarget = (target.goal as Goal)?.threshold ?? 1;
  const { error: updErr } = await supabase
    .from("mission_assignments")
    .update({
      mission_id: toMissionId,
      progress_current: 0,
      progress_target: newTarget,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);
  if (updErr) {
    // The swap-history row exists but the assignment didn't update —
    // shouldn't happen in practice (assignment is the same row we just
    // read), but if it does, surface a 500 so the client retries.
    return NextResponse.json(
      { error: "assignment_update_failed", detail: updErr.message },
      { status: 500 },
    );
  }

  // 6) Re-fetch the assignment + new mission row in the same response
  //    shape the active route returns, so the client splices straight
  //    into the cache.
  const { data: refreshed } = await supabase
    .from("mission_assignments")
    .select(`
      id, progress_current, progress_target, status, week_end_at, completed_at,
      reward_missions!inner(id, title, description, icon, difficulty, goal,
        reward_voucher_template_ids, reward_bonus_beans)
    `)
    .eq("id", assignmentId)
    .maybeSingle();

  if (!refreshed) {
    return NextResponse.json({ ok: true });
  }

  const mission = Array.isArray(refreshed.reward_missions)
    ? refreshed.reward_missions[0]
    : refreshed.reward_missions;

  // Resolve voucher titles for the reward_summary line.
  const voucherIds = (mission?.reward_voucher_template_ids ?? []) as string[];
  let summary = "Reward TBD";
  if (voucherIds.length === 1) {
    const { data: t } = await supabase
      .from("voucher_templates")
      .select("title")
      .eq("id", voucherIds[0])
      .maybeSingle();
    summary = (t?.title as string | undefined) ?? "1 voucher";
  } else if (voucherIds.length > 1) {
    summary = `${voucherIds.length} vouchers`;
  }

  return NextResponse.json({
    ok: true,
    updated_assignment: {
      assignment_id: refreshed.id,
      id: mission?.id,
      title: mission?.title,
      description: mission?.description,
      icon: mission?.icon,
      difficulty: mission?.difficulty,
      goal_type: (mission?.goal as Goal)?.type ?? "orders_count",
      goal_threshold: (mission?.goal as Goal)?.threshold ?? refreshed.progress_target,
      reward_summary: summary,
      progress_current: refreshed.progress_current,
      status: refreshed.status,
      week_end_at: refreshed.week_end_at,
      completed_at: refreshed.completed_at,
    },
  });
}
