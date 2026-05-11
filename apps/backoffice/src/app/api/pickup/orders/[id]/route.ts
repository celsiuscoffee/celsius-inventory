import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pickup/supabase";
import { requireAuth } from "@/lib/auth";

// GET /api/pickup/orders/[id]
// Returns one pickup order + its line items for the admin detail page.
// Service-role-backed so anon SELECT on orders can stay revoked.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    return NextResponse.json({ order, items: items ?? [] });
  } catch (err) {
    console.error("Pickup order detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
