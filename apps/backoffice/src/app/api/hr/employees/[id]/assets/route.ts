import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set([
  "laptop", "phone", "uniform", "apron", "keycard", "key", "name_tag",
  "locker", "tablet", "pos_terminal", "sim_card", "cash_float", "other",
]);
const VALID_STATUSES = new Set(["issued", "returned", "lost", "written_off"]);
const VALID_CONDITIONS = new Set(["good", "damaged", "lost", "not_returned"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await hrSupabaseAdmin
    .from("hr_company_assets")
    .select("*")
    .eq("user_id", id)
    .order("issued_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { asset_type, description, serial_number, issued_at, expected_return_at, notes } = body || {};
  if (!asset_type || !description || !issued_at) {
    return NextResponse.json({ error: "asset_type, description, issued_at required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(asset_type)) {
    return NextResponse.json({ error: `Invalid asset_type: ${asset_type}` }, { status: 400 });
  }
  const { data, error } = await hrSupabaseAdmin
    .from("hr_company_assets")
    .insert({
      user_id: id,
      asset_type,
      description,
      serial_number: serial_number || null,
      issued_at,
      expected_return_at: expected_return_at || null,
      notes: notes || null,
      created_by: session.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

// PATCH — return / mark lost / write off
// body: { asset_id, status, return_condition?, return_notes?, returned_at? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { asset_id, status, return_condition, return_notes, returned_at } = body || {};
  if (!asset_id || !status) return NextResponse.json({ error: "asset_id and status required" }, { status: 400 });
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  if (return_condition && !VALID_CONDITIONS.has(return_condition)) {
    return NextResponse.json({ error: `Invalid return_condition: ${return_condition}` }, { status: 400 });
  }
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "returned") {
    patch.returned_at = returned_at || new Date().toISOString().slice(0, 10);
    patch.return_condition = return_condition || "good";
    if (return_notes !== undefined) patch.return_notes = return_notes;
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_company_assets")
    .update(patch)
    .eq("id", asset_id)
    .eq("user_id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const assetId = new URL(req.url).searchParams.get("asset_id");
  if (!assetId) return NextResponse.json({ error: "asset_id required" }, { status: 400 });
  const { error } = await hrSupabaseAdmin
    .from("hr_company_assets")
    .delete()
    .eq("id", assetId)
    .eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
