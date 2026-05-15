// GET /api/loyalty/me/missions/[id]/swap-options
//
// Returns up to 3 candidate missions the customer could swap their
// current challenge for, plus a `can_swap` flag the client uses to
// gate the picker. Cap is one swap per member per week — enforced by
// the unique index on mission_swap_history(member_id, week_start_at).
//
// Eligibility rules:
// 1. The assignment must belong to the caller and be `active`.
// 2. The assignment's mission must itself be swap-eligible (otherwise
//    flagship "hero" challenges can't be ditched).
// 3. Member hasn't already swapped this week.
// 4. Candidate pool excludes:
//    - The current mission_id
//    - Any mission_id already in the member's active set this week
//      (no double-up — the customer should always have 3 distinct
//      challenges)
//    - Missions inside their cooldown window (recently completed)
//    - referrals_count missions (config-only, same exclusion as the
//      weekly seed)
// 5. Up to 3 random picks from the filtered pool.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

const BRAND_ID = (process.env.LOYALTY_BRAND_ID ?? "brand-celsius").trim();
const MAX_OPTIONS = 3;

type Goal = { type?: string; threshold?: number } | null;

type MissionRow = {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "easy" | "medium" | "hard";
  goal: Goal;
  reward_voucher_template_ids: string[] | null;
  reward_bonus_beans: number;
  cooldown_weeks: number;
  is_swap_eligible: boolean;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { id: assignmentId } = await params;
  const supabase = getSupabaseAdmin();

  // 1) Load the assignment + its mission row in one trip. Inner join
  //    ensures the mission row is present so we can read its
  //    is_swap_eligible flag.
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
    return NextResponse.json({
      can_swap: false,
      reason: "assignment_not_active",
      options: [],
      remaining_swaps_this_week: 0,
    });
  }

  // The assignment row joins reward_missions as either an array (when
  // selecting via FK) or an object — Supabase's PostgREST JSON shape.
  // Normalise to a single record.
  const rawMission = assignment.reward_missions as
    | { is_swap_eligible: boolean }
    | { is_swap_eligible: boolean }[]
    | null;
  const missionMeta = Array.isArray(rawMission) ? rawMission[0] : rawMission;
  if (!missionMeta?.is_swap_eligible) {
    return NextResponse.json({
      can_swap: false,
      reason: "mission_not_swap_eligible",
      options: [],
      remaining_swaps_this_week: 0,
    });
  }

  // 2) Has the member already swapped this week?
  const { data: existingSwap } = await supabase
    .from("mission_swap_history")
    .select("id")
    .eq("member_id", r.member.memberId)
    .eq("week_start_at", assignment.week_start_at)
    .maybeSingle();

  if (existingSwap) {
    return NextResponse.json({
      can_swap: false,
      reason: "already_swapped_this_week",
      options: [],
      remaining_swaps_this_week: 0,
    });
  }

  // 3) Pull the active mission pool (same filter as the weekly seed).
  const now = new Date().toISOString();
  const { data: poolRawAll } = await supabase
    .from("reward_missions")
    .select(
      "id, title, description, icon, difficulty, goal, reward_voucher_template_ids, reward_bonus_beans, cooldown_weeks, is_swap_eligible, starts_at, ends_at",
    )
    .eq("brand_id", BRAND_ID)
    .eq("is_active", true)
    .eq("is_swap_eligible", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  const poolRaw = (poolRawAll ?? []).filter(
    (m) => (m.goal as Goal)?.type !== "referrals_count",
  ) as MissionRow[];

  // 4) Exclude missions the member already has assigned this week —
  //    keeps the three weekly challenges distinct after a swap.
  const { data: thisWeek } = await supabase
    .from("mission_assignments")
    .select("mission_id")
    .eq("member_id", r.member.memberId)
    .eq("week_start_at", assignment.week_start_at);
  const assignedThisWeek = new Set((thisWeek ?? []).map((a) => a.mission_id as string));

  // 5) Cooldown filter (mirrors active route).
  const longestCooldown = Math.max(0, ...poolRaw.map((m) => m.cooldown_weeks ?? 4));
  const cooldownStart = new Date(
    Date.now() - longestCooldown * 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: recent } = await supabase
    .from("mission_assignments")
    .select("mission_id, completed_at")
    .eq("member_id", r.member.memberId)
    .eq("status", "completed")
    .gte("completed_at", cooldownStart);
  const blocked = new Set<string>();
  for (const a of recent ?? []) {
    if (!a.completed_at) continue;
    const m = poolRaw.find((x) => x.id === a.mission_id);
    if (!m) continue;
    const weeks = m.cooldown_weeks ?? 4;
    const expires =
      new Date(a.completed_at).getTime() + weeks * 7 * 24 * 60 * 60 * 1000;
    if (expires > Date.now()) blocked.add(m.id);
  }

  const eligible = poolRaw.filter(
    (m) => !assignedThisWeek.has(m.id) && !blocked.has(m.id),
  );

  // 6) Fisher-Yates shuffle, take top N.
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picks = shuffled.slice(0, MAX_OPTIONS);

  // 7) Resolve voucher titles for the reward_summary line.
  const voucherIds = new Set<string>();
  for (const p of picks) {
    for (const id of p.reward_voucher_template_ids ?? []) voucherIds.add(id);
  }
  const titleMap = new Map<string, string>();
  if (voucherIds.size > 0) {
    const { data: titles } = await supabase
      .from("voucher_templates")
      .select("id, title")
      .in("id", Array.from(voucherIds));
    for (const t of titles ?? []) titleMap.set(t.id as string, t.title as string);
  }

  const options = picks.map((m) => {
    const ids = m.reward_voucher_template_ids ?? [];
    const rewardSummary =
      ids.length === 0
        ? "Reward TBD"
        : ids.length === 1
          ? titleMap.get(ids[0]) ?? "1 voucher"
          : `${ids.length} vouchers`;
    return {
      mission_id: m.id,
      title: m.title,
      description: m.description,
      icon: m.icon,
      difficulty: m.difficulty,
      goal_type: m.goal?.type ?? "orders_count",
      goal_threshold: m.goal?.threshold ?? 1,
      reward_summary: rewardSummary,
      reward_bonus_beans: m.reward_bonus_beans,
    };
  });

  return NextResponse.json({
    can_swap: options.length > 0,
    reason: options.length === 0 ? "no_alternatives" : null,
    options,
    remaining_swaps_this_week: 1,
  });
}
