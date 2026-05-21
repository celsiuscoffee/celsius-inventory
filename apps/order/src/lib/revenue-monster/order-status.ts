import { getSupabaseAdmin } from "@/lib/supabase/server";
import { earnLoyaltyPoints, deductLoyaltyPoints } from "@/lib/loyalty/points";

// Shared between the RM webhook and the poll endpoint. Idempotent — both
// callers gate the update on `status = 'pending'` so a duplicate delivery
// (webhook + poll racing) doesn't double-earn points or double-deduct
// rewards. Returns true if this call actually transitioned the row.
export async function markRmOrderPaid(
  orderNumberOrId: { orderNumber?: string; orderId?: string },
  transactionId: string | null,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const base = supabase
    .from("orders")
    .update({
      status: "preparing",
      payment_provider_ref: transactionId,
    } as Record<string, unknown>)
    .eq("status", "pending");
  const filtered = orderNumberOrId.orderId
    ? base.eq("id", orderNumberOrId.orderId)
    : base.eq("order_number", orderNumberOrId.orderNumber!);
  const { data: order } = await filtered
    .select("id, loyalty_id, loyalty_points_earned, reward_id, store_id")
    .single<{
      id: string;
      loyalty_id: string | null;
      loyalty_points_earned: number;
      reward_id: string | null;
      store_id: string;
    }>();

  if (!order) return false;

  if (order.loyalty_id) {
    if (order.loyalty_points_earned > 0) {
      await earnLoyaltyPoints(
        order.loyalty_id,
        order.id,
        order.loyalty_points_earned,
        order.store_id,
      );
    }
    if (order.reward_id) {
      const ok = await deductLoyaltyPoints(order.loyalty_id, order.reward_id, order.store_id);
      if (!ok) {
        console.error(
          `[loyalty] markRmOrderPaid: FAILED to deduct points for order=${order.id} reward=${order.reward_id} — RECONCILE MANUALLY`,
        );
      }
    }
  }
  return true;
}

export async function markRmOrderFailed(
  orderNumberOrId: { orderNumber?: string; orderId?: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const base = supabase
    .from("orders")
    .update({ status: "failed" } as Record<string, unknown>);
  const filtered = orderNumberOrId.orderId
    ? base.eq("id", orderNumberOrId.orderId)
    : base.eq("order_number", orderNumberOrId.orderNumber!);
  await filtered;
}
