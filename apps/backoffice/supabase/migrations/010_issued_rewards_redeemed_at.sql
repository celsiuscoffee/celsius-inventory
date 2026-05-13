-- Add redeemed_at to issued_rewards.
--
-- The v2 wallet endpoints (/api/loyalty/me/vouchers, /vouchers/[id],
-- the claimable claim handler, the order confirm hooks) all
-- referenced redeemed_at on issued_rewards but the column was never
-- created. The vouchers list endpoint surfaced this as a 500 the moment
-- a customer had any active voucher: "I claimed it but Rewards tab is
-- empty". Adding nullable so the column is populated only when a
-- voucher is actually consumed at checkout.

ALTER TABLE public.issued_rewards
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_issued_rewards_redeemed_at
  ON public.issued_rewards(redeemed_at)
  WHERE redeemed_at IS NOT NULL;
