// POST /api/loyalty/admin-claimables/[id]/broadcast — proxies to the
// order app's internal-broadcast endpoint so the order app's push token
// store can do the actual fan-out. Backoffice doesn't keep push tokens.
//
// The order app exposes /api/internal/push/claimable which expects a
// shared secret (INTERNAL_PUSH_SECRET) — same pattern as cron auth.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

const ORDER_BASE = (process.env.ORDER_BASE_URL ?? "https://order.celsiuscoffee.com").trim();
const INTERNAL_SECRET = (process.env.INTERNAL_PUSH_SECRET ?? "").trim();

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  // Look up the claimable so we have title + audience.
  const { data: c } = await supabaseAdmin
    .from("admin_claimables")
    .select("id, title, member_ids, is_active")
    .eq("id", id)
    .single();
  if (!c) return NextResponse.json({ error: "Claimable not found" }, { status: 404 });
  if (!c.is_active) {
    return NextResponse.json({ error: "Claimable is paused — broadcast skipped" }, { status: 400 });
  }

  if (!INTERNAL_SECRET) {
    return NextResponse.json(
      { error: "INTERNAL_PUSH_SECRET not set on backoffice; push broadcast disabled" },
      { status: 503 },
    );
  }

  const explicit = c.member_ids ?? [];
  const audience = explicit.length === 0 ? "all" : "explicit";

  const res = await fetch(`${ORDER_BASE}/api/internal/push/claimable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": INTERNAL_SECRET,
    },
    body: JSON.stringify({
      title: c.title,
      member_ids: explicit,
      audience,
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: j.error ?? `Order app returned ${res.status}` },
      { status: 502 },
    );
  }
  const result = await res.json();
  return NextResponse.json(result);
}
