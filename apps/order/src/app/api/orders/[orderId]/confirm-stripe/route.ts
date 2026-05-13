import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { earnLoyaltyPoints, deductLoyaltyPoints } from "@/lib/loyalty/points";
import { applyOrderV2Hooks } from "@/lib/loyalty/v2";
import { notifyOrderPreparing } from "@/lib/push/templates";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

/**
 * POST /api/orders/[orderId]/confirm-stripe
 *
 * Client-side fallback for when the Stripe webhook is delayed or misconfigured.
 * Called from the order tracking page when the customer returns from Stripe with
 * redirect_status=succeeded but the order is still "pending" in our DB.
 *
 * Verifies the PaymentIntent server-side and, if succeeded, advances the order
 * to "preparing" — same as the webhook handler does.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    const body = await request.json() as { paymentIntentId?: string };
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== "succeeded") {
      return NextResponse.json({ confirmed: false, status: intent.status });
    }

    // Security: the PaymentIntent metadata must carry the orderId we're confirming
    if (intent.metadata?.orderId !== orderId) {
      return NextResponse.json({ error: "Order mismatch" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: updated } = await supabase
      .from("orders")
      .update({
        status:               "preparing",
        payment_provider_ref: intent.id,
      } as Record<string, unknown>)
      .eq("id", orderId)
      .eq("status", "pending") // idempotent — only acts if still pending
      .select("loyalty_id, loyalty_points_earned, reward_id, wallet_voucher_id, store_id, order_number, customer_phone, created_at")
      .single();

    if (updated?.loyalty_id) {
      const outletId = updated.store_id as string;
      if ((updated.loyalty_points_earned as number) > 0) {
        earnLoyaltyPoints(updated.loyalty_id as string, orderId, updated.loyalty_points_earned as number, outletId);
      }
      if (updated.reward_id) {
        deductLoyaltyPoints(updated.loyalty_id as string, updated.reward_id as string, outletId);
      }

      // Rewards v2 hooks — wallet voucher redemption, mission progress,
      // mystery drop, referral payoff. Shared with the Stripe webhook
      // + zero-pay route. Wrapped in after() so the response isn't
      // blocked on Supabase.
      const loyaltyId = updated.loyalty_id as string;
      const orderCreatedAt = (updated.created_at as string) ?? new Date().toISOString();
      const walletVoucherId = (updated.wallet_voucher_id as string | null) ?? null;
      after(async () => {
        await applyOrderV2Hooks({
          memberId: loyaltyId,
          orderId,
          outletId,
          orderCreatedAt,
          walletVoucherId,
        });
      });
    }

    // "Brewing now ☕" push. Same template the webhook fires — whichever
    // path lands first wins, and the row update being gated on
    // status="pending" means the second path's select returns null and
    // skips the push. So even if both webhook and confirm-stripe race,
    // the customer gets exactly one preparing push.
    if (updated) {
      const orderRow = updated as { order_number: string; customer_phone: string | null };
      after(async () => {
        await notifyOrderPreparing({
          orderId,
          orderNumber:   orderRow.order_number,
          customerPhone: orderRow.customer_phone,
        }).catch((e) => console.warn("[push] order_preparing confirm-stripe", e));
      });
    }

    return NextResponse.json({ confirmed: true });
  } catch (err) {
    console.error("confirm-stripe error:", err);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
