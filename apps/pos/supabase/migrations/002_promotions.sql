-- ==========================================
-- Celsius POS — Promotions
-- Mirrors StoreHub's 5 promotion types
-- ==========================================

-- ─── Promotions ────────────────────────────────────────────
-- 5 types: percentage_off, amount_off, buy_x_get_y, combo_bundle, override_price

CREATE TABLE promotions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id          UUID NOT NULL,
  name              TEXT NOT NULL,                  -- Appears on POS when applied
  promo_code        TEXT,                           -- For online channels (nullable for POS-only)
  discount_type     TEXT NOT NULL
                      CHECK (discount_type IN ('percentage_off', 'amount_off', 'buy_x_get_y', 'combo_bundle', 'override_price')),

  -- Discount value
  discount_value    INTEGER,                        -- sen for amount_off, basis points for percentage_off (1000 = 10%)
  combo_price       INTEGER,                        -- sen — fixed price for combo_bundle
  override_price    INTEGER,                        -- sen — new price for override_price

  -- Buy X Get Y
  buy_quantity      INTEGER,                        -- Buy X
  free_quantity     INTEGER,                        -- Get Y free

  -- Apply to (what gets discounted)
  apply_to          TEXT NOT NULL DEFAULT 'all_orders'
                      CHECK (apply_to IN ('all_orders', 'orders_over', 'category', 'tags', 'specific_products')),
  apply_min_order   INTEGER,                        -- sen — for 'orders_over'
  apply_categories  TEXT[],                         -- category slugs
  apply_tags        TEXT[],                         -- product tags
  apply_product_ids UUID[],                         -- specific product IDs
  apply_min_qty     INTEGER,                        -- min quantity to qualify
  apply_max_qty     INTEGER,                        -- max quantity that gets discount

  -- Required purchase (prerequisite)
  require_purchase          BOOLEAN NOT NULL DEFAULT false,
  require_categories        TEXT[],
  require_tags              TEXT[],
  require_product_ids       UUID[],
  require_min_qty           INTEGER,

  -- Customer eligibility
  customer_eligibility      TEXT NOT NULL DEFAULT 'everyone'
                              CHECK (customer_eligibility IN ('everyone', 'customer_tags', 'first_time', 'membership')),
  eligible_customer_tags    TEXT[],
  eligible_membership_tiers TEXT[],

  -- Usage limits (for online channels)
  total_usage_limit         INTEGER,                -- total times promo can be used
  per_customer_limit        INTEGER,                -- per customer limit
  current_usage_count       INTEGER NOT NULL DEFAULT 0,

  -- Repeat in transaction
  allow_repeat              BOOLEAN NOT NULL DEFAULT false,

  -- Channels
  channels                  TEXT[] NOT NULL DEFAULT '{pos}',  -- pos, online, delivery, qr

  -- Stores
  branch_ids                UUID[],                  -- which branches (null = all)

  -- Scheduling
  is_enabled                BOOLEAN NOT NULL DEFAULT false,
  start_date                TIMESTAMPTZ,
  end_date                  TIMESTAMPTZ,             -- null = no end

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-apply modes:
-- percentage_off, amount_off → manual on POS, promo code online
-- buy_x_get_y, combo_bundle, override_price → auto-apply on POS

CREATE INDEX idx_promotions_brand ON promotions(brand_id);
CREATE INDEX idx_promotions_enabled ON promotions(is_enabled, start_date, end_date);
CREATE INDEX idx_promotions_code ON promotions(promo_code) WHERE promo_code IS NOT NULL;

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_promotions" ON promotions FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
