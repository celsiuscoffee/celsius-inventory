// Birthday config — single key/value pair in app_config:
//   key = 'birthday_voucher_template_id'
//   value = <uuid of the voucher_template to issue>
//
// Daily cron `/api/cron/birthday-treats` in the order app reads this
// to know which template to drop into birthday-week customers' wallets.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

const KEY = "birthday_voucher_template_id";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();

  return NextResponse.json({ template_id: (data?.value as string | null) ?? null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const templateId = body?.template_id as string | null;

  const { error } = await supabaseAdmin
    .from("app_config")
    .upsert({ key: KEY, value: templateId, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template_id: templateId });
}
