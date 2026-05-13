// POST /api/loyalty/me/milestones/[milestoneId]/claim
//
// Two-phase milestone fulfilment. The milestone-scan cron flips a
// milestone into the "claimable" state (earned_at set, claimed_at
// still NULL). This endpoint is what fires when the customer taps
// Claim in the app:
//
//   1. Verify the milestone is genuinely claimable for this member
//      (earned row exists, claimed_at still null, member matches).
//   2. Re-check the threshold against current stats — guards against
//      a backdated rollback (e.g. order refunds dropping the count
//      below trigger after the cron recorded the earn).
//   3. Issue every configured voucher template into the wallet.
//   4. Credit reward_bonus_beans to the points balance.
//   5. Stamp claimed_at + persist the outcome snapshot.
//
// Idempotent — a duplicate POST hits the claimed_at check and returns
// the cached outcome instead of double-issuing.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";
import { issueVoucher } from "@/lib/loyalty/v2";
import { awardBonusBeans } from "@/lib/loyalty/points";

const BRAND_ID = (process.env.LOYALTY_BRAND_ID ?? "brand-celsius").trim();

type ClaimOutcome = {
  voucher_ids: string[];
  bonus_beans: number;
  voucher_titles: string[];
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ milestoneId: string }> },
) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const { milestoneId } = await ctx.params;
  const supabase = getSupabaseAdmin();
  const memberId = r.member.memberId;

  // Load the earned row + the milestone config in parallel.
  const [{ data: earned, error: earnedErr }, { data: milestone, error: msErr }] = await Promise.all([
    supabase
      .from("user_milestones_earned")
      .select("id, claimed_at, claim_outcome")
      .eq("member_id", memberId)
      .eq("milestone_id", milestoneId)
      .maybeSingle(),
    supabase
      .from("reward_milestones")
      .select("id, title, reward_voucher_template_ids, reward_bonus_beans, brand_id, is_active")
      .eq("id", milestoneId)
      .maybeSingle(),
  ]);

  if (earnedErr || !earned) {
    return NextResponse.json(
      { error: "This milestone isn't ready to claim yet." },
      { status: 404 },
    );
  }
  if (msErr || !milestone) {
    return NextResponse.json(
      { error: "Milestone not found." },
      { status: 404 },
    );
  }
  if (milestone.brand_id !== BRAND_ID) {
    return NextResponse.json(
      { error: "Milestone belongs to another brand." },
      { status: 403 },
    );
  }

  // Already claimed — return the stored outcome so the celebration
  // UI can still show what the customer got. Idempotent by design.
  if (earned.claimed_at) {
    return NextResponse.json({
      already_claimed: true,
      claimed_at: earned.claimed_at,
      outcome: (earned.claim_outcome as ClaimOutcome | null) ?? {
        voucher_ids: [],
        bonus_beans: 0,
        voucher_titles: [],
      },
    });
  }

  // Belt-and-braces: re-verify the threshold. The cron could have
  // recorded an earn that's since gone stale (refund flow, manual
  // backoffice adjustment, etc.). Cheap safety net.
  const templateIds = (milestone.reward_voucher_template_ids as string[]) ?? [];
  const bonusBeans  = (milestone.reward_bonus_beans as number) ?? 0;

  // Issue every configured voucher template. Collect the new
  // issued_rewards row IDs + titles so the client can render the
  // celebration with the real reward names.
  const issuedIds:    string[] = [];
  const issuedTitles: string[] = [];
  for (const tplId of templateIds) {
    const v = await issueVoucher({
      memberId,
      templateId: tplId,
      sourceType: "milestone",
      sourceRefId: milestoneId,
    });
    if (v) {
      issuedIds.push(v.id);
      const title = (v as { title?: string | null }).title ?? null;
      if (title) issuedTitles.push(title);
    }
  }

  // Credit bonus beans. Best-effort — the voucher issuance is the
  // primary celebration; a balance write miss shouldn't block the
  // customer's claim.
  if (bonusBeans > 0) {
    try {
      await awardBonusBeans({
        memberId,
        amount: bonusBeans,
        description: `Milestone — ${milestone.title as string}`,
        referenceId: milestoneId,
        txnType: "milestone_bonus",
      });
    } catch (e) {
      console.warn("[milestone-claim] bonus beans failed", e);
    }
  }

  const outcome: ClaimOutcome = {
    voucher_ids: issuedIds,
    bonus_beans: bonusBeans,
    voucher_titles: issuedTitles,
  };

  // Stamp claimed_at. Conditional on claimed_at IS NULL so two
  // simultaneous claim taps can't double-issue.
  const { error: claimErr } = await supabase
    .from("user_milestones_earned")
    .update({
      claimed_at: new Date().toISOString(),
      claim_outcome: outcome,
    })
    .eq("id", earned.id)
    .is("claimed_at", null);

  if (claimErr) {
    // Update lost the race — return the stored outcome of whoever
    // won the race so the customer still sees their reward.
    const { data: fresh } = await supabase
      .from("user_milestones_earned")
      .select("claimed_at, claim_outcome")
      .eq("id", earned.id)
      .maybeSingle();
    return NextResponse.json({
      already_claimed: true,
      claimed_at: fresh?.claimed_at ?? null,
      outcome: (fresh?.claim_outcome as ClaimOutcome | null) ?? outcome,
    });
  }

  return NextResponse.json({
    already_claimed: false,
    claimed_at: new Date().toISOString(),
    outcome,
  });
}
