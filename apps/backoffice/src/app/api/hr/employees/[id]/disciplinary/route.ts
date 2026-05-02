import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set([
  "verbal_warning", "written_warning", "final_written_warning",
  "suspension", "pip", "dismissal", "note",
]);
const VALID_SEVERITY = new Set(["minor", "moderate", "major", "gross"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { data, error } = await hrSupabaseAdmin
    .from("hr_disciplinary_actions")
    .select("*")
    .eq("user_id", id)
    .order("issued_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { issued_at, category, severity, incident_date, reason, action_taken, effective_until, notes } = body || {};
  if (!issued_at || !category || !reason) {
    return NextResponse.json({ error: "issued_at, category, reason required" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }
  if (severity && !VALID_SEVERITY.has(severity)) {
    return NextResponse.json({ error: `Invalid severity: ${severity}` }, { status: 400 });
  }
  const { data, error } = await hrSupabaseAdmin
    .from("hr_disciplinary_actions")
    .insert({
      user_id: id,
      issued_at,
      category,
      severity: severity || "minor",
      incident_date: incident_date || null,
      reason,
      action_taken: action_taken || null,
      effective_until: effective_until || null,
      notes: notes || null,
      created_by: session.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-issue a staff-app memo so the employee acknowledges the action.
  // Skip for "note" category — that's an internal-only HR record (LoE clause C3
  // doesn't require a written acknowledgement for notes).
  if (category !== "note") {
    const memoType = ["verbal_warning", "written_warning", "final_written_warning"].includes(category)
      ? (category === "verbal_warning" ? "verbal_warning" : "written_warning")
      : "note";
    const memoSeverity = severity === "gross" || severity === "major" ? "major"
      : severity === "moderate" ? "minor"
      : "info";
    const titleMap: Record<string, string> = {
      verbal_warning: "Verbal Warning",
      written_warning: "Written Warning",
      final_written_warning: "Final Written Warning",
      suspension: "Suspension",
      pip: "Performance Improvement Plan",
      dismissal: "Notice of Dismissal",
    };
    const title = titleMap[category] || "Disciplinary Notice";
    const memoBody = [
      `Issued ${issued_at}.`,
      "",
      "Reason:",
      reason,
      action_taken ? "" : null,
      action_taken ? "Action taken:" : null,
      action_taken ? action_taken : null,
      effective_until ? "" : null,
      effective_until ? `Effective until ${effective_until}.` : null,
    ].filter((s) => s !== null).join("\n");

    await hrSupabaseAdmin.from("hr_memos").insert({
      user_id: id,           // legacy single-recipient column
      user_ids: [id],
      issued_by: session.id,
      type: memoType,
      severity: memoSeverity,
      title,
      body: memoBody,
      related_type: "disciplinary_action",
      related_id: data?.id ?? null,
      status: "active",
    });
  }

  return NextResponse.json({ action: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { action_id, status, acknowledged_at } = body || {};
  if (!action_id) return NextResponse.json({ error: "action_id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) {
    if (!["active", "closed", "rescinded"].includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    patch.status = status;
  }
  if (acknowledged_at !== undefined) patch.acknowledged_at = acknowledged_at;

  const { data, error } = await hrSupabaseAdmin
    .from("hr_disciplinary_actions")
    .update(patch)
    .eq("id", action_id)
    .eq("user_id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const actionId = new URL(req.url).searchParams.get("action_id");
  if (!actionId) return NextResponse.json({ error: "action_id required" }, { status: 400 });
  const { error } = await hrSupabaseAdmin
    .from("hr_disciplinary_actions")
    .delete()
    .eq("id", actionId)
    .eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
