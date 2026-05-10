import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireCustomerSession } from "@/lib/customer-jwt";

// GET /api/members/order-count?phone=+601XXXXXXXX
// Returns the number of completed/active orders for a phone — used to determine
// first-order discount eligibility on the client before placing the order.
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ count: 0 });

  const guard = requireCustomerSession(request);
  if (guard.error) return guard.error as unknown as NextResponse;
  if (guard.session && guard.session.phone !== phone) {
    return NextResponse.json({ error: "Session does not match phone" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("loyalty_phone", phone)
    .in("status", ["completed", "preparing", "ready", "paid"]);

  return NextResponse.json({ count: count ?? 0 });
}
