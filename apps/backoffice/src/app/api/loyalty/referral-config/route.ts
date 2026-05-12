// Referral config — two keys in app_config:
//   key='referral_referrer_voucher_template_id', value=<uuid>
//   key='referral_referee_voucher_template_id',  value=<uuid>
//
// Both must be set for the referral payout to fire. If either is null,
// the system silently skips (referral disabled).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

const REFERRER_KEY = "referral_referrer_voucher_template_id";
const REFEREE_KEY  = "referral_referee_voucher_template_id";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { data } = await supabaseAdmin
    .from("app_config")
    .select("key, value")
    .in("key", [REFERRER_KEY, REFEREE_KEY]);

  const m = new Map((data ?? []).map((r) => [r.key as string, r.value as string | null]));
  return NextResponse.json({
    referrer_template_id: m.get(REFERRER_KEY) ?? null,
    referee_template_id:  m.get(REFEREE_KEY)  ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const now = new Date().toISOString();

  const rows = [
    { key: REFERRER_KEY, value: body.referrer_template_id ?? null, updated_at: now },
    { key: REFEREE_KEY,  value: body.referee_template_id  ?? null, updated_at: now },
  ];

  const { error } = await supabaseAdmin
    .from("app_config")
    .upsert(rows, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
