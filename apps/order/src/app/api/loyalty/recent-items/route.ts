import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// GET /api/loyalty/recent-items?phone=+60xxx&limit=3
// Returns the customer's most-frequently ordered products from their last
// ~50 paid order_items. Used by the native home screen as "your go-to drinks".
//
// Response shape:
//   { items: [{ id, name, image_url, price, timesOrdered }] }
//
// Empty array if member is new / no qualifying orders. CDN-cached lightly so
// home doesn't hammer Supabase on every cold launch.
export const revalidate = 60;

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
    10,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 3)
  );

  try {
    const supabase = getSupabaseAdmin();
    const phone = normalisePhone(phoneParam);

    // Pull the most recent items this customer ordered. We only count items
    // from non-cancelled orders so spam attempts don't pollute go-tos.
    const { data: items, error } = await supabase
      .from("order_items")
      .select(
        "product_id, product_name, quantity, orders!inner(customer_phone, status, created_at)"
      )
      .eq("orders.customer_phone", phone)
      .in("orders.status", ["paid", "preparing", "ready", "completed"])
      .order("created_at", { ascending: false, foreignTable: "orders" })
      .limit(50);

    if (error) {
      console.error("recent-items query error:", error);
      return NextResponse.json({ items: [] });
    }

    // Aggregate by product_id — sum quantities so a 2x latte counts more than 1x
    const tally = new Map<
      string,
      { id: string; name: string; timesOrdered: number }
    >();
    for (const it of items ?? []) {
      const id = it.product_id;
      if (!id) continue;
      const existing = tally.get(id);
      const qty = (it.quantity as number) ?? 1;
      if (existing) {
        existing.timesOrdered += qty;
      } else {
        tally.set(id, {
          id,
          name: (it.product_name as string) ?? "",
          timesOrdered: qty,
        });
      }
    }

    const ranked = Array.from(tally.values())
      .sort((a, b) => b.timesOrdered - a.timesOrdered)
      .slice(0, limit);

    if (ranked.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Join in current image + price from products table (so we don't show
    // stale prices/images from old orders).
    const ids = ranked.map((r) => r.id);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, image_url, price, is_available")
      .in("id", ids);

    const byId = new Map(
      (products ?? []).map((p) => [p.id as string, p])
    );

    const out = ranked
      .map((r) => {
        const p = byId.get(r.id);
        if (!p || !p.is_available) return null;
        return {
          id: r.id,
          name: (p.name as string) ?? r.name,
          image_url: (p.image_url as string) ?? null,
          price: (p.price as number) ?? 0,
          timesOrdered: r.timesOrdered,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: out });
  } catch (err) {
    console.error("recent-items route error:", err);
    return NextResponse.json({ items: [] });
  }
}
