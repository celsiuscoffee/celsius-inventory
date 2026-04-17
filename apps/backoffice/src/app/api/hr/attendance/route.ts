import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: list attendance logs with filters
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "flagged"; // default to flagged only
  const outletId = searchParams.get("outlet_id");
  const limit = parseInt(searchParams.get("limit") || "50");

  let query = hrSupabaseAdmin
    .from("hr_attendance_logs")
    .select("*")
    .order("clock_in", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("ai_status", status);
  }
  if (outletId) {
    query = query.eq("outlet_id", outletId);
  }
  // Managers only see their outlet
  if (session.role === "MANAGER" && session.outletId) {
    query = query.eq("outlet_id", session.outletId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user name + fullName + outlet name
  const userIds = Array.from(new Set((data || []).map((l: { user_id: string }) => l.user_id)));
  const outletIds = Array.from(
    new Set((data || []).map((l: { outlet_id: string }) => l.outlet_id).filter(Boolean)),
  );

  const [users, outlets] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, fullName: true },
        })
      : Promise.resolve([]),
    outletIds.length > 0
      ? prisma.outlet.findMany({
          where: { id: { in: outletIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const outletMap = new Map(outlets.map((o) => [o.id, o.name]));

  const enriched = (data || []).map((log: { user_id: string; outlet_id: string }) => {
    const u = userMap.get(log.user_id);
    return {
      ...log,
      user_name: u?.fullName || u?.name || null,
      user_nickname: u?.name || null,
      outlet_name: outletMap.get(log.outlet_id) || null,
    };
  });

  return NextResponse.json({ logs: enriched, count: enriched.length });
}

// PATCH: review a flagged attendance log
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, action, adjustedHours, notes } = body as {
    id: string;
    action: "approve" | "reject" | "adjust";
    adjustedHours?: number;
    notes?: string;
  };

  const updateData: Record<string, unknown> = {
    ai_status: "reviewed",
    reviewed_by: session.id,
    reviewed_at: new Date().toISOString(),
    review_notes: notes || null,
  };

  if (action === "approve") {
    updateData.final_status = "approved";
  } else if (action === "reject") {
    updateData.final_status = "rejected";
  } else if (action === "adjust" && adjustedHours != null) {
    updateData.final_status = "adjusted";
    updateData.total_hours = adjustedHours;
    updateData.regular_hours = Math.min(adjustedHours, 8);
    updateData.overtime_hours = Math.max(0, adjustedHours - 8);
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_attendance_logs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
