import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const yearParam = new URL(req.url).searchParams.get("year");
  let q = hrSupabaseAdmin.from("hr_public_holidays").select("*").order("date");
  if (yearParam) q = q.eq("year", Number(yearParam));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holidays: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { date, name, is_national, state } = body || {};
  if (!date || !name) return NextResponse.json({ error: "date and name required" }, { status: 400 });
  const year = Number(String(date).slice(0, 4));
  const { data, error } = await hrSupabaseAdmin
    .from("hr_public_holidays")
    .insert({ date, name, year, is_national: is_national ?? true, state: state || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holiday: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await hrSupabaseAdmin.from("hr_public_holidays").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
