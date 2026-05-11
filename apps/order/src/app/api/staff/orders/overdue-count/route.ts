import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Returns the count of "preparing" orders at a store that are older than
 * a given cutoff. Used by the bottom-nav red dot on non-Orders tabs to
 * surface an overdue indicator without exposing order data to the client.
 *
 *   GET /api/staff/orders/overdue-count?store=X&before=ISO
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const storeId = sp.get("store");
  const before  = sp.get("before");

  if (!storeId || !before) {
    return NextResponse.json({ error: "Missing store or before" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "preparing")
    .lt("created_at", before);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ count: count ?? 0 });
}
