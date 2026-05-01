import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

// GET ?year=YYYY — list tax reliefs for the employee in a given year, joined with catalog.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const yearParam = new URL(req.url).searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  const { data: rows, error } = await hrSupabaseAdmin
    .from("hr_employee_tax_reliefs")
    .select("*")
    .eq("user_id", id)
    .eq("year", year);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const codes = Array.from(new Set((rows || []).map((r: { relief_code: string }) => r.relief_code)));
  const { data: catalog } = codes.length
    ? await hrSupabaseAdmin
        .from("hr_tax_relief_catalog")
        .select("code, name, parent_code, ea_form_field, max_amount, notes")
        .in("code", codes)
    : { data: [] as Array<{ code: string }> };
  const catMap = new Map((catalog || []).map((c: { code: string }) => [c.code, c]));
  const enriched = (rows || []).map((r: { relief_code: string }) => ({
    ...r,
    catalog: catMap.get(r.relief_code) || null,
  }));

  return NextResponse.json({ year, reliefs: enriched });
}

// POST: upsert (user_id, year, relief_code).
// body: { year, relief_code, amount_100pct?, amount_50pct? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { year, relief_code, amount_100pct, amount_50pct } = body || {};

  if (!year || !relief_code) {
    return NextResponse.json({ error: "year and relief_code required" }, { status: 400 });
  }
  if (amount_100pct == null && amount_50pct == null) {
    return NextResponse.json({ error: "Provide amount_100pct or amount_50pct" }, { status: 400 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_employee_tax_reliefs")
    .upsert(
      {
        user_id: id,
        year: Number(year),
        relief_code,
        amount_100pct: amount_100pct != null ? Number(amount_100pct) : null,
        amount_50pct: amount_50pct != null ? Number(amount_50pct) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,relief_code" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ relief: data });
}

// DELETE ?relief_id=X — remove a relief row.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reliefId = new URL(req.url).searchParams.get("relief_id");
  if (!reliefId) return NextResponse.json({ error: "relief_id required" }, { status: 400 });

  const { error } = await hrSupabaseAdmin
    .from("hr_employee_tax_reliefs")
    .delete()
    .eq("id", reliefId)
    .eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
