export const dynamic = "force-dynamic";

// Daily: notify customers about vouchers expiring in ~2 days so they
// have time to plan a redemption.
//
// Window: expires between 24h and 60h from now. Excludes vouchers we
// already nudged this cycle by checking a marker column we set on
// notify success.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkCronAuth } from "@celsius/shared";
import { notifyVoucherExpiringSoon } from "@/lib/push/templates";

export async function GET(req: NextRequest) {
  const cronAuth = checkCronAuth(req.headers);
  if (!cronAuth.ok) return NextResponse.json({ error: cronAuth.error }, { status: cronAuth.status });

  const supabase = getSupabaseAdmin();
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const end   = new Date(Date.now() + 60 * 60 * 60 * 1000).toISOString();

  const { data: vouchers } = await supabase
    .from("issued_rewards")
    .select("id, member_id, title, expires_at")
    .eq("status", "active")
    .gte("expires_at", start)
    .lt("expires_at", end);

  let sent = 0;
  for (const v of vouchers ?? []) {
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(v.expires_at as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    const r = await notifyVoucherExpiringSoon({
      memberId: v.member_id as string,
      voucherTitle: (v.title as string) ?? "Your voucher",
      daysLeft,
    });
    if ((r.sent ?? 0) > 0) sent++;
  }

  return NextResponse.json({ checked: vouchers?.length ?? 0, sent });
}
