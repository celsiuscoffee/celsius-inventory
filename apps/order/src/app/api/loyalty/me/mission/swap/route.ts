// POST /api/loyalty/me/mission/swap — cancel the current active mission
// so the customer can pick a new one. Idempotent.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";

export async function POST(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mission_assignments")
    .update({ status: "swapped" })
    .eq("member_id", r.member.memberId)
    .eq("status", "active")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ swapped: (data ?? []).length > 0 });
}
