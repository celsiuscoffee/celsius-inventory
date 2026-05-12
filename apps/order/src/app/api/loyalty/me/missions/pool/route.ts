// GET /api/loyalty/me/missions/pool — picker pool for this week.
//
// Returns active missions, filtered by:
//   - is_active = true
//   - within starts_at/ends_at window if set
//   - exclude missions the customer completed within `cooldown_weeks`
//     so the same challenge doesn't re-offer immediately.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

const BRAND_ID = (process.env.LOYALTY_BRAND_ID ?? "brand-celsius").trim();

type MissionRow = {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "easy" | "medium" | "hard";
  goal: { type: string; threshold: number };
  reward_voucher_template_ids: string[];
  reward_bonus_beans: number;
  cooldown_weeks: number;
};

export async function GET(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Active missions in window.
  const { data: missionsRaw } = await supabase
    .from("reward_missions")
    .select("id, title, description, icon, difficulty, goal, reward_voucher_template_ids, reward_bonus_beans, cooldown_weeks, starts_at, ends_at")
    .eq("brand_id", BRAND_ID)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  if (!missionsRaw || missionsRaw.length === 0) return NextResponse.json([]);

  // Cooldown — fetch completed-within-cooldown assignments for this member.
  // Compute the longest cooldown across the pool so we can scope the query.
  const longestCooldown = Math.max(
    ...missionsRaw.map((m) => m.cooldown_weeks ?? 4),
  );
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
    const m = missionsRaw.find((x) => x.id === a.mission_id);
    if (!m) continue;
    const weeks = m.cooldown_weeks ?? 4;
    const expires = new Date(a.completed_at).getTime() + weeks * 7 * 24 * 60 * 60 * 1000;
    if (expires > Date.now()) blocked.add(m.id);
  }

  const pool: MissionRow[] = missionsRaw
    .filter((m) => !blocked.has(m.id))
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      icon: m.icon,
      difficulty: m.difficulty,
      goal: m.goal as MissionRow["goal"],
      reward_voucher_template_ids: m.reward_voucher_template_ids ?? [],
      reward_bonus_beans: m.reward_bonus_beans ?? 0,
      cooldown_weeks: m.cooldown_weeks ?? 4,
    }));

  return NextResponse.json(
    pool.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      icon: m.icon,
      difficulty: m.difficulty,
      goal_threshold: m.goal?.threshold ?? 0,
      reward_summary: summariseReward(m),
    })),
  );
}

function summariseReward(m: MissionRow): string {
  const ids = m.reward_voucher_template_ids ?? [];
  const parts: string[] = [];
  if (ids.length === 1) parts.push("1 voucher");
  if (ids.length > 1) parts.push(`${ids.length} vouchers`);
  if (m.reward_bonus_beans > 0) parts.push(`+${m.reward_bonus_beans} Beans`);
  return parts.join(" + ") || "Bonus rewards";
}
