import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/loyalty/push-campaigns
 *
 * Returns every push-notification campaign with rolling 7d + 30d
 * stats — sent / opened / orders attributed / revenue attributed.
 * Backoffice list view reads this to render the table; the row
 * action (toggle on/off) hits PATCH on /[key].
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { data: campaigns, error } = await supabaseAdmin
    .from("notification_campaigns")
    .select("id, key, name, description, trigger_config, audience_filter, frequency_cap_count, frequency_cap_days, send_window_start_hour, send_window_end_hour, enabled, title_template, body_template, deeplink_path, trigger_kind, is_seeded, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now    = Date.now();
  const day7   = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString();
  const day30  = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Pull all sends from the last 30d in one query and bucket in
  // memory — avoids per-campaign queries growing with N. Even at
  // 100k sends/month this stays well under a single round-trip.
  const { data: sends } = await supabaseAdmin
    .from("notification_sends")
    .select("campaign_id, sent_at, opened_at, attributed_order_id, attributed_revenue, delivered_count")
    .gte("sent_at", day30);

  type Stats = {
    sent7: number; sent30: number;
    opened7: number; opened30: number;
    orders7: number; orders30: number;
    revenue7: number; revenue30: number;
  };
  const empty = (): Stats => ({ sent7: 0, sent30: 0, opened7: 0, opened30: 0, orders7: 0, orders30: 0, revenue7: 0, revenue30: 0 });
  const byCampaign = new Map<string, Stats>();

  for (const s of (sends ?? []) as Array<{ campaign_id: string; sent_at: string; opened_at: string | null; attributed_order_id: string | null; attributed_revenue: number | null; delivered_count: number }>) {
    const stats = byCampaign.get(s.campaign_id) ?? empty();
    const sentAt = s.sent_at;
    stats.sent30 += s.delivered_count;
    if (s.opened_at) stats.opened30++;
    if (s.attributed_order_id) {
      stats.orders30++;
      stats.revenue30 += Number(s.attributed_revenue ?? 0);
    }
    if (sentAt >= day7) {
      stats.sent7 += s.delivered_count;
      if (s.opened_at) stats.opened7++;
      if (s.attributed_order_id) {
        stats.orders7++;
        stats.revenue7 += Number(s.attributed_revenue ?? 0);
      }
    }
    byCampaign.set(s.campaign_id, stats);
  }

  const rows = (campaigns ?? []).map((c) => {
    const stats = byCampaign.get((c as { id: string }).id) ?? empty();
    return { ...c, stats };
  });

  return NextResponse.json({ campaigns: rows });
}

/**
 * POST /api/loyalty/push-campaigns
 *
 * Creates a new custom campaign. Built-in campaigns are seeded via
 * migration; this endpoint always sets trigger_kind = 'custom' so an
 * admin can't accidentally create a name collision with a future
 * built-in by typing the wrong key.
 *
 * Disabled by default — admin opens it, fills in the audience rule
 * + template, then flips Enable on. Saves a step's worth of "I just
 * created an empty campaign and it accidentally tried to send".
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const name: string | undefined = typeof body.name === "string" ? body.name.trim() : undefined;
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    // Auto-derive a stable key from the name. Lowercased + collapsed
    // to underscores. Suffix with the millis if the slug already
    // exists so admins don't have to think about uniqueness.
    const baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "campaign";
    let key = baseKey;
    {
      const { data: existing } = await supabaseAdmin
        .from("notification_campaigns")
        .select("key")
        .eq("key", baseKey)
        .maybeSingle();
      if (existing) key = `${baseKey}_${Date.now().toString(36)}`;
    }

    const { data, error } = await supabaseAdmin
      .from("notification_campaigns")
      .insert({
        key,
        name,
        description:    body.description ?? null,
        trigger_kind:   "custom",
        is_seeded:      false,
        enabled:        false,
        // Default audience filter is empty — cron skips empty rules
        // explicitly, so a freshly-created campaign never blasts
        // every member by accident.
        audience_filter: body.audience_filter ?? {},
        title_template:  body.title_template ?? null,
        body_template:   body.body_template ?? null,
        deeplink_path:   body.deeplink_path ?? null,
        frequency_cap_count: body.frequency_cap_count ?? 1,
        frequency_cap_days:  body.frequency_cap_days ?? 7,
        send_window_start_hour: body.send_window_start_hour ?? 9,
        send_window_end_hour:   body.send_window_end_hour ?? 21,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[push-campaigns POST]", err);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
