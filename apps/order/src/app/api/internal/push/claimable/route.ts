// POST /api/internal/push/claimable — internal-only endpoint called by
// the backoffice to broadcast a "claim now" push.
//
// Auth: X-Internal-Secret header must match INTERNAL_PUSH_SECRET.
//
// Body: { title: string, member_ids?: string[] }  // empty = broadcast

import { NextRequest, NextResponse } from "next/server";
import { notifyClaimableReady } from "@/lib/push/templates";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SECRET   = (process.env.INTERNAL_PUSH_SECRET ?? "").trim();
const BRAND_ID = (process.env.LOYALTY_BRAND_ID    ?? "brand-celsius").trim();

// Soft cap on broadcast fan-out so a bad admin click doesn't try to
// push to 100k members in one request.
const BROADCAST_CAP = 5000;

export async function POST(request: NextRequest) {
  const provided = (request.headers.get("x-internal-secret") ?? "").trim();
  if (!SECRET || provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = body?.title as string | undefined;
  const memberIds = Array.isArray(body?.member_ids) ? (body.member_ids as string[]) : [];
  const audience  = (body?.audience as string | undefined) ?? "explicit";

  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Resolve target audience.
  let targets: string[] = [];
  if (audience === "all") {
    // Broadcast to all brand members. Capped + best-effort — large fan-outs
    // should go through a real campaign job; this is for moderate-sized
    // pushes from the backoffice.
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("member_brands")
      .select("member_id")
      .eq("brand_id", BRAND_ID)
      .limit(BROADCAST_CAP + 1);
    targets = (data ?? []).map((r) => r.member_id as string);
    if (targets.length > BROADCAST_CAP) {
      return NextResponse.json(
        { error: `Audience too large (${targets.length} > ${BROADCAST_CAP}). Use a targeted member_ids list.` },
        { status: 413 },
      );
    }
  } else {
    targets = memberIds;
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  for (const memberId of targets) {
    const r = await notifyClaimableReady({ memberId, title }).catch(() => null);
    if (r) {
      sent += r.sent ?? 0;
      failed += r.failed ?? 0;
    } else {
      failed++;
    }
  }

  return NextResponse.json({ recipients: targets.length, sent, failed });
}
