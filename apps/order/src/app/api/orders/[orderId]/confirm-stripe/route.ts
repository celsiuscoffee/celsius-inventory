import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { earnLoyaltyPoints, deductLoyaltyPoints } from "@/lib/loyalty/points";
import { applyOrderToMission, generateMysteryDrop, maybeRewardReferralOnFirstOrder } from "@/lib/loyalty/v2";
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
      // Wallet voucher redemption — mark the issued_rewards row as
      // consumed. Doesn't deduct Beans (wallet vouchers cost nothing).
      if (updated.wallet_voucher_id) {
        after(async () => {
          await supabase
            .from("issued_rewards")
            .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
            .eq("id", updated.wallet_voucher_id as string)
            .eq("member_id", updated.loyalty_id as string);
        });
      }

      // ─── Rewards v2 hooks ────────────────────────────────────────
      // Both run in `after()` so they don't block the customer's
      // "payment success" response. Mission tracker increments their
      // active challenge progress; mystery drop generator picks a
      // weighted outcome which the order confirmation screen reveals
      // on tap.
      const loyaltyId = updated.loyalty_id as string;
      after(async () => {
        try {
          // Look up order items + count for mission goal evaluation.
          const { data: items } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", orderId);
          const itemIds = (items ?? []).map((i) => i.product_id as string);
          const itemCount = (items ?? []).reduce((sum, i) => sum + ((i.quantity as number) ?? 0), 0);
          const totalSen = 0; // optional; use updated.total_sen if you start tracking it

          await applyOrderToMission({
            memberId: loyaltyId,
            order: {
              id: orderId,
              outlet_id: outletId,
              item_ids: itemIds,
              item_count: itemCount,
              total_sen: totalSen,
              created_at: (updated.created_at as string) ?? new Date().toISOString(),
            },
          });
        } catch (e) {
          console.warn("[v2] applyOrderToMission failed", e);
        }

        try {
          // Look up the member's current tier + birthday month so the
          // mystery pool weighting can apply tier-gates and birthday
          // boost (mystery_pool.birthday_month_boost).
          const [{ data: memberBrand }, { data: memberRow }] = await Promise.all([
            supabase
              .from("member_brands")
              .select("tiers(slug)")
              .eq("member_id", loyaltyId)
              .eq("brand_id", "brand-celsius")
              .single(),
            supabase
              .from("members")
              .select("brand_data")
              .eq("id", loyaltyId)
              .single(),
          ]);
          const tierSlug = (memberBrand as { tiers?: { slug?: string } | null } | null)?.tiers?.slug ?? null;
          const bdayIso = (memberRow?.brand_data as { birthday?: string | null } | null)?.birthday ?? null;
          const birthdayMonth = bdayIso ? new Date(bdayIso).getMonth() + 1 : null;

          await generateMysteryDrop({
            memberId: loyaltyId,
            orderId,
            memberTier: tierSlug,
            birthdayMonth,
          });
        } catch (e) {
          console.warn("[v2] generateMysteryDrop failed", e);
        }

        // Referral payoff — fires on the referee's first qualifying order.
        // Idempotent against `referral_attributions.status` so a 2nd order
        // by the same referee is a no-op.
        try {
          await maybeRewardReferralOnFirstOrder({
            memberId: loyaltyId,
            orderId,
          });
        } catch (e) {
          console.warn("[v2] maybeRewardReferralOnFirstOrder failed", e);
        }
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
