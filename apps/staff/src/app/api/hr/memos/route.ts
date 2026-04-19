import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/hr/memos — my memos
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("hr_memos")
    .select("*")
    .eq("user_id", session.id)
    .eq("status", "active")
    .order("issued_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const issuerIds = Array.from(new Set((data || []).map((m) => m.issued_by)));
  const issuers = issuerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: issuerIds } },
        select: { id: true, name: true, fullName: true },
      })
    : [];
  const issuerMap = new Map(issuers.map((u) => [u.id, u]));

  const enriched = (data || []).map((m) => ({
    ...m,
    issued_by_name: issuerMap.get(m.issued_by)?.fullName || issuerMap.get(m.issued_by)?.name || "Manager",
  }));

  const unacknowledged = enriched.filter((m) => !m.acknowledged_at).length;
  return NextResponse.json({ memos: enriched, unacknowledgedCount: unacknowledged });
}

// PATCH: acknowledge a memo
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, notes } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("hr_memos")
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledgement_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", session.id)
    .is("acknowledged_at", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memo: data });
}
