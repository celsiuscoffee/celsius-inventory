-- Two-phase milestone fulfilment.
--
-- Before: milestone-scan cron auto-issued vouchers + credited beans the
-- moment a member crossed a threshold. The customer never tapped
-- anything; the reward just appeared in their wallet. That removed all
-- agency from the moment and made the achievement feel anticlimactic.
--
-- After: cron only RECORDS that the threshold was crossed (earned_at).
-- The reward is granted when the customer taps "Claim" in the
-- Milestones tab — at which point we set claimed_at + snapshot the
-- outcome for analytics.
--
-- claim_outcome stores what we actually issued at claim time:
--   { voucher_template_ids: [...], voucher_ids: [...], bonus_beans: N }
-- so we can reproduce the "this is what landed in your wallet" celebration
-- UI on the next session if the customer dismisses it mid-animation.

ALTER TABLE public.user_milestones_earned
  ADD COLUMN IF NOT EXISTS claimed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS claim_outcome jsonb;

-- Backfill: every milestone row that already exists was claimed
-- automatically under the old flow. Pretend the customer claimed at
-- the same instant they qualified so they don't see a stale "Claim"
-- pill in the UI for milestones they earned weeks ago.
UPDATE public.user_milestones_earned
   SET claimed_at = earned_at
 WHERE claimed_at IS NULL;

-- Faster "is this milestone claimable for this member?" lookups.
CREATE INDEX IF NOT EXISTS idx_user_milestones_earned_unclaimed
  ON public.user_milestones_earned(member_id)
  WHERE claimed_at IS NULL;
