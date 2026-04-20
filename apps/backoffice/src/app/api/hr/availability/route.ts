import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

// GET /api/hr/availability?user_id=X — list one staff's weekly availability
// GET /api/hr/availability                → everyone's (OWNER/ADMIN only)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("user_id");
  const canSeeAll = ["OWNER", "ADMIN"].includes(session.role);
  const target = userId || session.id;
  if (!canSeeAll && target !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let q = hrSupabaseAdmin
    .from("hr_staff_weekly_availability")
    .select("*")
    .order("day_of_week")
    .order("available_from");
  if (userId || !canSeeAll) q = q.eq("user_id", target);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ availability: data ?? [] });
}

// POST /api/hr/availability  body: { user_id, day_of_week, available_from, available_until, is_preferred?, max_shifts_per_week?, notes? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { user_id, day_of_week, available_from, available_until, is_preferred, max_shifts_per_week, notes } = body;

  const canEditOthers = ["OWNER", "ADMIN"].includes(session.role);
  const target = user_id || session.id;
  if (!canEditOthers && target !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (day_of_week == null || !available_from || !available_until) {
    return NextResponse.json({ error: "day_of_week, available_from, available_until required" }, { status: 400 });
  }
  if (day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: "day_of_week must be 0-6 (Sun=0, Sat=6)" }, { status: 400 });
  }
  if (available_from >= available_until) {
    return NextResponse.json({ error: "available_from must be before available_until" }, { status: 400 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_staff_weekly_availability")
    .insert({
      user_id: target,
      day_of_week,
      available_from,
      available_until,
      is_preferred: is_preferred ?? false,
      max_shifts_per_week: max_shifts_per_week ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ availability: data });
}

// DELETE /api/hr/availability?id=X
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Owner/admin can delete any; staff only their own
  const { data: row } = await hrSupabaseAdmin
    .from("hr_staff_weekly_availability")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canEditOthers = ["OWNER", "ADMIN"].includes(session.role);
  if (!canEditOthers && row.user_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await hrSupabaseAdmin
    .from("hr_staff_weekly_availability")
    .delete()
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
