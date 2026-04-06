import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Delivery Platform Webhook Endpoint
 *
 * Receives orders from delivery aggregators (Deliverect, Klikit, etc.)
 * and creates them in the POS system.
 *
 * POST /api/delivery/webhook
 *
 * Expected payload (Deliverect-compatible):
 * {
 *   "event": "order.created" | "order.updated" | "order.cancelled",
 *   "order": {
 *     "externalId": "grab-12345",
 *     "platform": "grabfood" | "foodpanda",
 *     "type": "delivery" | "pickup",
 *     "status": "new" | "accepted" | "preparing" | "ready" | "picked_up",
 *     "customer": { "name": "...", "phone": "..." },
 *     "items": [{ "name": "...", "quantity": 1, "price": 1490, "modifiers": [...], "notes": "..." }],
 *     "subtotal": 3290,
 *     "deliveryFee": 500,
 *     "discount": 0,
 *     "total": 3790,
 *     "notes": "...",
 *     "scheduledFor": null,
 *     "outlet": { "id": "outlet-sa", "name": "Shah Alam" }
 *   }
 * }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, order } = body;

    // Verify webhook secret (set in Deliverect dashboard)
    const secret = req.headers.get("x-webhook-secret");
    if (process.env.DELIVERY_WEBHOOK_SECRET && secret !== process.env.DELIVERY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    switch (event) {
      case "order.created":
        return handleNewOrder(order);
      case "order.updated":
        return handleOrderUpdate(order);
      case "order.cancelled":
        return handleOrderCancel(order);
      default:
        return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[DELIVERY WEBHOOK] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleNewOrder(order: any) {
  const outletId = order.outlet?.id ?? "outlet-sa";
  const platform = order.platform ?? "unknown";
  const orderNumber = `${platform.toUpperCase().substring(0, 4)}-${order.externalId ?? Date.now()}`;

  // Create POS order
  const { data: posOrder, error: orderError } = await supabase
    .from("pos_orders")
    .insert({
      order_number: orderNumber,
      outlet_id: outletId,
      source: platform, // 'grabfood', 'foodpanda'
      order_type: order.type === "pickup" ? "takeaway" : "takeaway", // delivery is treated as takeaway
      status: "sent_to_kitchen", // auto-accept and send to kitchen
      subtotal: order.subtotal ?? 0,
      total: order.total ?? 0,
      customer_phone: order.customer?.phone ?? null,
      customer_name: order.customer?.name ?? null,
      notes: `[${platform.toUpperCase()}] ${order.notes ?? ""}`.trim(),
    })
    .select()
    .single();

  if (orderError) {
    console.error("[DELIVERY] Create order error:", orderError);
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Create order items
  const items = (order.items ?? []).map((item: any) => ({
    order_id: posOrder.id,
    product_id: item.productId ?? item.externalId ?? "unknown",
    product_name: item.name,
    quantity: item.quantity ?? 1,
    unit_price: item.price ?? 0,
    modifiers: item.modifiers ?? [],
    modifier_total: (item.modifiers ?? []).reduce((s: number, m: any) => s + (m.price ?? 0), 0),
    item_total: (item.price ?? 0) * (item.quantity ?? 1),
    notes: item.notes ?? null,
    kitchen_station: null, // Will be set based on product mapping
    kitchen_status: "pending",
  }));

  if (items.length > 0) {
    await supabase.from("pos_order_items").insert(items);
  }

  // Auto-create payment record (delivery platform collects payment)
  await supabase.from("pos_order_payments").insert({
    order_id: posOrder.id,
    payment_method: platform,
    provider: platform,
    amount: order.total ?? 0,
    status: "completed",
    provider_ref: order.externalId,
  });

  console.log(`[DELIVERY] New ${platform} order: ${orderNumber}`);

  return NextResponse.json({
    success: true,
    orderId: posOrder.id,
    orderNumber,
    status: "accepted",
  });
}

async function handleOrderUpdate(order: any) {
  const { error } = await supabase
    .from("pos_orders")
    .update({ status: mapStatus(order.status) })
    .eq("order_number", order.orderNumber ?? "")
    .or(`notes.ilike.%${order.externalId}%`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleOrderCancel(order: any) {
  const { error } = await supabase
    .from("pos_orders")
    .update({
      status: "cancelled",
      cancellation_reason: `Cancelled by ${order.platform ?? "platform"}`,
    })
    .eq("order_number", order.orderNumber ?? "")
    .or(`notes.ilike.%${order.externalId}%`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function mapStatus(platformStatus: string): string {
  const map: Record<string, string> = {
    new: "open",
    accepted: "sent_to_kitchen",
    preparing: "sent_to_kitchen",
    ready: "ready",
    picked_up: "completed",
    delivered: "completed",
    cancelled: "cancelled",
  };
  return map[platformStatus] ?? "open";
}
