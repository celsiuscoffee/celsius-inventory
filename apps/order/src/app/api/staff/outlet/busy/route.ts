import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET ?storeId=conezion → { busy: boolean }
export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "Missing storeId" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("outlet_settings")
    .select("is_busy")
    .eq("store_id", storeId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
  return NextResponse.json({ busy: Boolean(data.is_busy) });
}

// POST { storeId, busy } → flips outlet_settings.is_busy. Customer-facing
// store list reads from the same table so the change shows up immediately.
export async function POST(request: NextRequest) {
  const { storeId, busy } = await request.json() as { storeId?: string; busy?: boolean };
  if (!storeId || typeof busy !== "boolean") {
    return NextResponse.json({ error: "Missing storeId or busy flag" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("outlet_settings")
    .update({ is_busy: busy })
    .eq("store_id", storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, busy });
}
