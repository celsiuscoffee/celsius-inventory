import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/hr/memos?userId=xxx&status=active|rescinded|all&type=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status") || "active";
  const type = searchParams.get("type");

  let q = hrSupabaseAdmin
    .from("hr_memos")
    .select("*")
    .order("issued_at", { ascending: false })
    .limit(200);
  if (userId) q = q.eq("user_id", userId);
  if (status !== "all") q = q.eq("status", status);
  if (type) q = q.eq("type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with names
  const uids = Array.from(new Set((data || []).flatMap((m) => [m.user_id, m.issued_by])));
  const users = uids.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: uids } },
        select: { id: true, name: true, fullName: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = (data || []).map((m) => ({
    ...m,
    user_name: userMap.get(m.user_id)?.fullName || userMap.get(m.user_id)?.name || null,
    issued_by_name: userMap.get(m.issued_by)?.fullName || userMap.get(m.issued_by)?.name || null,
  }));

  return NextResponse.json({ memos: enriched });
}

// POST: issue a memo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { user_id, type, severity, title, body: memoBody, related_type, related_id } = body;
  if (!user_id || !type || !title || !memoBody) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["verbal_warning", "written_warning", "commendation", "note"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_memos")
    .insert({
      user_id,
      issued_by: session.id,
      type,
      severity: severity || "info",
      title,
      body: memoBody,
      related_type: related_type || "standalone",
      related_id: related_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memo: data });
}

// PATCH: rescind a memo
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, action, reason } = await req.json();
  if (!id || action !== "rescind") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_memos")
    .update({
      status: "rescinded",
      rescinded_at: new Date().toISOString(),
      rescinded_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memo: data });
}
