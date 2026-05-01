import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set([
  "lhdn_form_e", "lhdn_cp8d", "lhdn_cp39_pcb", "kwsp_form_a", "perkeso_form",
  "hrdf", "work_permit", "license_renewal", "audit", "other",
]);
const VALID_RECURRENCE = new Set(["one_off", "monthly", "quarterly", "annual"]);

// GET — upcoming events; optional ?upcoming=N (days), ?status=, ?category=.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const upcomingDays = Number(searchParams.get("upcoming") || 0);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  let q = hrSupabaseAdmin.from("hr_compliance_events").select("*").order("due_date");
  if (status) q = q.eq("status", status);
  if (category) q = q.eq("category", category);
  if (upcomingDays > 0) {
    const horizon = new Date(Date.now() + upcomingDays * 86400000).toISOString().slice(0, 10);
    q = q.lte("due_date", horizon).neq("status", "done");
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Roll forward overdue items so the dashboard can highlight them.
  const today = new Date().toISOString().slice(0, 10);
  const enriched = (data || []).map((e: { due_date: string; status: string }) => ({
    ...e,
    is_overdue: e.status === "pending" && e.due_date < today,
  }));
  return NextResponse.json({ events: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { category, title, due_date, recurrence, related_user_id, reminder_days, notes } = body || {};
  if (!category || !title || !due_date) {
    return NextResponse.json({ error: "category, title, due_date required" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }
  if (recurrence && !VALID_RECURRENCE.has(recurrence)) {
    return NextResponse.json({ error: `Invalid recurrence: ${recurrence}` }, { status: 400 });
  }
  const { data, error } = await hrSupabaseAdmin
    .from("hr_compliance_events")
    .insert({
      category,
      title,
      due_date,
      recurrence: recurrence || "one_off",
      related_user_id: related_user_id || null,
      reminder_days: reminder_days ?? 14,
      notes: notes || null,
      created_by: session.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

// PATCH — mark done / snooze / cancel.
// When marking a recurring event done, automatically schedule the next occurrence.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { event_id, status, due_date } = body || {};
  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) {
    if (!["pending","done","overdue","snoozed","cancelled"].includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    patch.status = status;
    if (status === "done") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = session.id;
    }
  }
  if (due_date) patch.due_date = due_date;

  const { data, error } = await hrSupabaseAdmin
    .from("hr_compliance_events")
    .update(patch)
    .eq("id", event_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-schedule next occurrence for recurring events.
  if (status === "done" && data?.recurrence && data.recurrence !== "one_off") {
    const next = nextDueDate(data.due_date, data.recurrence as string);
    await hrSupabaseAdmin.from("hr_compliance_events").insert({
      category: data.category,
      title: data.title,
      due_date: next,
      recurrence: data.recurrence,
      related_user_id: data.related_user_id,
      reminder_days: data.reminder_days,
      notes: data.notes,
      created_by: session.id,
    });
  }
  return NextResponse.json({ event: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await hrSupabaseAdmin.from("hr_compliance_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function nextDueDate(prev: string, recurrence: string): string {
  const d = new Date(`${prev}T00:00:00.000Z`);
  if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (recurrence === "quarterly") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (recurrence === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
