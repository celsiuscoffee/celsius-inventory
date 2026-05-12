// GET /api/loyalty/me/mission/active — the customer's currently-active
// weekly challenge. Returns null when no mission is picked for this week.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

type AssignmentRow = {
  id: string;
  progress_current: number;
  progress_target: number;
  status: string;
  week_end_at: string;
  completed_at: string | null;
  reward_missions: {
    id: string;
    title: string;
    description: string;
    icon: string;
    difficulty: "easy" | "medium" | "hard";
    goal: { type: string; threshold: number };
    reward_voucher_template_ids: string[];
    reward_bonus_beans: number;
  };
};

export async function GET(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mission_assignments")
    .select(`
      id, progress_current, progress_target, status, week_end_at, completed_at,
      reward_missions!inner(id, title, description, icon, difficulty, goal,
        reward_voucher_template_ids, reward_bonus_beans)
    `)
    .eq("member_id", r.member.memberId)
    .in("status", ["active"])
    .order("week_start_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json(null);

  const a = data as unknown as AssignmentRow;
  return NextResponse.json({
    assignment_id: a.id,
    id: a.reward_missions.id,
    title: a.reward_missions.title,
    description: a.reward_missions.description,
    icon: a.reward_missions.icon,
    difficulty: a.reward_missions.difficulty,
    goal_threshold: a.reward_missions.goal?.threshold ?? a.progress_target,
    reward_summary: summariseReward(a.reward_missions),
    progress_current: a.progress_current,
    status: a.status,
    week_end_at: a.week_end_at,
    completed_at: a.completed_at,
  });
}

function summariseReward(m: AssignmentRow["reward_missions"]): string {
  // Quick text for the UI — full breakdown is in the picker pool.
  const ids = m.reward_voucher_template_ids ?? [];
  const parts: string[] = [];
  if (ids.length === 1) parts.push("1 voucher");
  if (ids.length > 1) parts.push(`${ids.length} vouchers`);
  if (m.reward_bonus_beans > 0) parts.push(`+${m.reward_bonus_beans} Beans`);
  return parts.join(" + ") || "Bonus rewards";
}
