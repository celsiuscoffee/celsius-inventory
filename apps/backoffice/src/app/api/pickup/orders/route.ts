import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pickup/supabase";
import { requireAuth } from "@/lib/auth";

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0"))  return `+6${digits}`;
  return `+60${digits}`;
}

// GET /api/pickup/orders
// Query params:
//   from       ISO timestamp lower bound (inclusive) on created_at
//   to         YYYY-MM-DD upper bound (inclusive, sets to end-of-day)
//   store      Outlet slug, e.g. "conezion". "all" = no filter.
//   status     Single status filter (legacy). "all" = no filter.
//   statuses   Comma-separated status list (preferred). Takes precedence
//              over `status` when present.
//   phone      Customer phone (normalised to +60...).
//   limit      Cap on rows returned. Default 200, hard ceiling 2000.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = request.nextUrl;
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const store    = searchParams.get("store");
    const status   = searchParams.get("status");
    const statuses = searchParams.get("statuses");
    const phone    = searchParams.get("phone");
    const limitRaw = Number(searchParams.get("limit"));
    const limit    = Math.min(2000, Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200));

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (from   && from   !== "")    query = query.gte("created_at", new Date(from).toISOString());
    if (to     && to     !== "")    query = query.lte("created_at", new Date(to + "T23:59:59").toISOString());
    if (store  && store  !== "all") query = query.eq("store_id", store);
    if (statuses && statuses !== "") {
      const list = statuses.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) query = query.in("status", list);
    } else if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (phone  && phone  !== "")    query = query.eq("customer_phone", normalisePhone(phone));

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Pickup orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
