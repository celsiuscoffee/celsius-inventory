import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

// GET — list salary history for a user (most recent first).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await hrSupabaseAdmin
    .from("hr_salary_history")
    .select("*")
    .eq("user_id", id)
    .order("effective_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// POST — log a salary change (increment, promotion, restructure).
// body: { effective_date, salary_type, amount, comment? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { effective_date, salary_type, amount, comment } = body || {};
  if (!effective_date || !salary_type || amount == null) {
    return NextResponse.json({ error: "effective_date, salary_type, amount required" }, { status: 400 });
  }
  if (!["base","hourly","allowance","bonus","increment"].includes(salary_type)) {
    return NextResponse.json({ error: `Invalid salary_type: ${salary_type}` }, { status: 400 });
  }
  if (Number(amount) < 0) return NextResponse.json({ error: "amount must be ≥ 0" }, { status: 400 });

  // Close any open prior entry of the same type so we don't have overlapping rows.
  await hrSupabaseAdmin
    .from("hr_salary_history")
    .update({ end_date: effective_date })
    .eq("user_id", id)
    .eq("salary_type", salary_type)
    .is("end_date", null)
    .lt("effective_date", effective_date);

  const { data, error } = await hrSupabaseAdmin
    .from("hr_salary_history")
    .insert({
      user_id: id,
      effective_date,
      salary_type,
      amount: Number(amount),
      comment: comment || null,
      created_by: session.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror the new value onto the live profile so payroll picks it up.
  if (salary_type === "base" && Date.parse(effective_date) <= Date.now()) {
    await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .update({ basic_salary: Number(amount) })
      .eq("user_id", id);
  }
  if (salary_type === "hourly" && Date.parse(effective_date) <= Date.now()) {
    await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .update({ hourly_rate: Number(amount) })
      .eq("user_id", id);
  }

  return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const entryId = new URL(req.url).searchParams.get("entry_id");
  if (!entryId) return NextResponse.json({ error: "entry_id required" }, { status: 400 });
  const { error } = await hrSupabaseAdmin
    .from("hr_salary_history")
    .delete()
    .eq("id", entryId)
    .eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
