import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET /api/loyalty/orders?phone=+60xxx&limit=20
// Returns the customer's most recent orders, with line items, for the
// pickup app's Orders tab. Read-only; identified by phone (already
// OTP-verified at login).
//
// Response: { orders: [{ id, order_number, status, total, created_at,
//   payment_method, store_id, items: [{ product_id, product_name,
//   quantity, item_total, modifiers }] }] }

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+6${digits}`;
  return `+60${digits}`;
}

export async function GET(request: NextRequest) {
  const phoneParam = request.nextUrl.searchParams.get("phone");
  if (!phoneParam) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
  }
  const limit = Math.min(
    50,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20)
  );

  try {
    const supabase = getSupabaseAdmin();
    const phone = normalisePhone(phoneParam);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, total, created_at, payment_method, store_id, " +
          "order_items(product_id, product_name, quantity, item_total, modifiers, unit_price)"
      )
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("orders history query error:", error);
      return NextResponse.json({ orders: [] });
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (err) {
    console.error("orders history route error:", err);
    return NextResponse.json({ orders: [] });
  }
}
