import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const brandId = new URL(request.url).searchParams.get("brand_id");
  if (!brandId) return NextResponse.json({ error: "brand_id is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("reward_milestones")
    .select("*")
    .eq("brand_id", brandId)
    .order("trigger_value", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.brand_id || !body.title || !body.trigger_type || body.trigger_value === undefined) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reward_milestones")
    .insert({
      brand_id: body.brand_id,
      title: body.title,
      description: body.description ?? "",
      icon: body.icon ?? "star",
      trigger_type: body.trigger_type,
      trigger_value: body.trigger_value,
      reward_voucher_template_ids: body.reward_voucher_template_ids ?? [],
      reward_bonus_beans: body.reward_bonus_beans ?? 0,
      reward_unlock: body.reward_unlock ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("reward_milestones")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("reward_milestones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
