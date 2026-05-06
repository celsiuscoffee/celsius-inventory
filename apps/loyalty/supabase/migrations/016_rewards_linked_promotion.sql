-- ==========================================
-- Migration 016: Link rewards → promotions
-- Lets a reward delegate its discount mechanics to the promotion
-- engine instead of carrying its own discount_type / discount_value
-- / BOGO / combo fields. Cleans up the rewards table over time.
-- ==========================================

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS linked_promotion_id TEXT
  REFERENCES promotions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rewards_linked_promo
  ON rewards(linked_promotion_id)
  WHERE linked_promotion_id IS NOT NULL;
