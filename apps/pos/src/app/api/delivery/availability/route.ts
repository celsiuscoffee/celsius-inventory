import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Product Availability API for Delivery Platforms
 *
 * GET /api/delivery/availability
 *   → Returns all products with availability status
 *
 * PATCH /api/delivery/availability
 *   → Update availability for specific products
 *   → Body: { "products": [{ "id": "...", "available": true/false }] }
 *
 * When staff marks a product as "86" (sold out) on the POS,
 * Deliverect can poll this endpoint or receive a webhook to
 * sync availability across GrabFood/FoodPanda.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, is_available")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    lastUpdated: new Date().toISOString(),
    products: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      available: p.is_available,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const updates = body.products ?? [];

    for (const item of updates) {
      await supabase
        .from("products")
        .update({ is_available: item.available })
        .eq("id", item.id);
    }

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
