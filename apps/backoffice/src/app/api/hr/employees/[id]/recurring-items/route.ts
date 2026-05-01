import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

// GET: list recurring items for an employee, joined with catalog metadata.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: items, error } = await hrSupabaseAdmin
    .from("hr_employee_recurring_items")
    .select("*")
    .eq("user_id", id)
    .order("effective_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const codes = Array.from(new Set((items || []).map((i: { catalog_code: string }) => i.catalog_code)));
  const { data: catalog } = codes.length
    ? await hrSupabaseAdmin
        .from("hr_payroll_item_catalog")
        .select("code, name, category, item_type, ea_form_field, pcb_taxable, epf_contributing, socso_contributing, eis_contributing")
        .in("code", codes)
    : { data: [] as Array<{ code: string }> };

  const catMap = new Map((catalog || []).map((c: { code: string }) => [c.code, c]));
  const enriched = (items || []).map((i: { catalog_code: string }) => ({
    ...i,
    catalog: catMap.get(i.catalog_code) || null,
  }));

  return NextResponse.json({ items: enriched });
}

// POST: add a recurring item.
// body: { catalog_code, kind, amount, effective_date, end_date?, note?, unique_identifier? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { catalog_code, kind, amount, effective_date, end_date, note, unique_identifier } = body || {};

  if (!catalog_code || !kind || amount == null || !effective_date) {
    return NextResponse.json(
      { error: "catalog_code, kind, amount, effective_date required" },
      { status: 400 },
    );
  }
  if (!["addition", "deduction"].includes(kind)) {
    return NextResponse.json({ error: "kind must be 'addition' or 'deduction'" }, { status: 400 });
  }
  if (Number(amount) < 0) {
    return NextResponse.json({ error: "amount must be ≥ 0" }, { status: 400 });
  }

  // Validate the catalog code exists.
  const { data: cat } = await hrSupabaseAdmin
    .from("hr_payroll_item_catalog")
    .select("code, category, is_active")
    .eq("code", catalog_code)
    .maybeSingle();
  if (!cat || cat.is_active === false) {
    return NextResponse.json({ error: "Unknown or inactive catalog_code" }, { status: 400 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_employee_recurring_items")
    .insert({
      user_id: id,
      catalog_code,
      kind,
      amount: Number(amount),
      effective_date,
      end_date: end_date || null,
      note: note || null,
      unique_identifier: unique_identifier || null,
      created_by: session.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// DELETE ?item_id=X — remove a recurring item.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = new URL(req.url).searchParams.get("item_id");
  if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const { error } = await hrSupabaseAdmin
    .from("hr_employee_recurring_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
