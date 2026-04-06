-- ==========================================
-- Celsius POS — Initial Schema
-- All amounts in SEN (integer). RM 12.50 = 1250
-- Field names aligned with Pickup/Loyalty/Inventory apps
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Branches ──────────────────────────────────────────────
-- Matches Inventory Branch model + Loyalty outlets convention

CREATE TABLE branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT UNIQUE NOT NULL,          -- e.g. "CC-IOI"
  name            TEXT NOT NULL,                 -- e.g. "Celsius Coffee IOI Conezion"
  branch_type     TEXT NOT NULL DEFAULT 'outlet' -- 'outlet' | 'central_kitchen'
                    CHECK (branch_type IN ('outlet', 'central_kitchen')),
  address         TEXT,
  city            TEXT,
  state           TEXT,
  phone           TEXT,
  storehub_id     TEXT UNIQUE,                   -- StoreHub store ID (migration)
  operating_hours JSONB,                         -- {"mon": {"open":"08:00","close":"22:00"}, ...}
  timezone        TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Staff Users ───────────────────────────────────────────
-- Matches Loyalty staff_users table

CREATE TABLE staff_users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id          UUID NOT NULL,               -- Celsius brand UUID
  branch_id         UUID REFERENCES branches(id),
  name              TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT,                         -- +60XXXXXXXXX
  role              TEXT NOT NULL DEFAULT 'staff'
                      CHECK (role IN ('admin', 'manager', 'staff')),
  pin_hash          TEXT,                         -- bcrypt hashed 4-digit PIN
  assigned_branches UUID[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Registers ─────────────────────────────────────────────

CREATE TABLE registers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES branches(id),
  name       TEXT NOT NULL,                      -- "Register 1"
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- ─── Product Categories ────────────────────────────────────
-- Matches Pickup product_categories

CREATE TABLE product_categories (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id              UUID NOT NULL,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  storehub_category_id  TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, slug)
);

-- ─── Products ──────────────────────────────────────────────
-- Matches Pickup/Loyalty products table structure
-- All prices in SEN

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL,
  storehub_id     TEXT UNIQUE,                   -- migration key
  name            TEXT NOT NULL,
  sku             TEXT,
  category        TEXT,                          -- category slug
  tags            TEXT[] DEFAULT '{}',
  description     TEXT,
  image_url       TEXT,
  image_urls      TEXT[] DEFAULT '{}',
  price           INTEGER NOT NULL DEFAULT 0,    -- sen
  cost            INTEGER,                       -- sen
  online_price    INTEGER,                       -- sen
  tax_code        TEXT,
  tax_rate        INTEGER NOT NULL DEFAULT 0,    -- basis points (600 = 6%)
  pricing_type    TEXT NOT NULL DEFAULT 'fixed'
                    CHECK (pricing_type IN ('fixed', 'variable', 'weight')),
  modifiers       JSONB NOT NULL DEFAULT '[]',   -- same JSONB as Pickup
  track_stock     BOOLEAN NOT NULL DEFAULT false,
  stock_level     INTEGER,
  kitchen_station TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Product Variants ──────────────────────────────────────
-- Matches Pickup product_variants

CREATE TABLE product_variants (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sku                 TEXT,
  barcode             TEXT,
  price               INTEGER,                   -- sen, NULL = use parent
  cost                INTEGER,
  stock_level         INTEGER,
  storehub_variant_id TEXT,
  is_available        BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Branch Stock Levels ───────────────────────────────────
-- Per-product, per-branch stock tracking

CREATE TABLE branch_stock_levels (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, product_id, variant_id)
);

-- ─── Product Recipes (BOM / Composite Inventory) ──────────
-- Links menu items to raw ingredients
-- ingredient_sku maps to Inventory Product.sku (by convention, not FK)

CREATE TABLE product_recipes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_name   TEXT NOT NULL,
  ingredient_sku    TEXT,                        -- maps to Inventory Product.sku
  quantity_used     DECIMAL(10,3) NOT NULL,      -- amount per 1 sold
  uom               TEXT NOT NULL                -- g, ml, pcs
);

-- ─── Tax Codes ─────────────────────────────────────────────

CREATE TABLE tax_codes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,                    -- "SST 6%"
  code         TEXT UNIQUE NOT NULL,             -- "SST6"
  rate         INTEGER NOT NULL,                 -- basis points (600 = 6%)
  is_inclusive BOOLEAN NOT NULL DEFAULT true,
  is_active    BOOLEAN NOT NULL DEFAULT true
);

-- ─── Kitchen Stations ──────────────────────────────────────

CREATE TABLE kitchen_stations (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  name      TEXT NOT NULL,                       -- "Bar", "Hot Kitchen"
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ─── Branch Settings ───────────────────────────────────────
-- Per-outlet config. Matches Pickup outlet_settings convention

CREATE TABLE branch_settings (
  branch_id           UUID PRIMARY KEY REFERENCES branches(id),
  is_open             BOOLEAN NOT NULL DEFAULT true,
  service_charge_rate INTEGER NOT NULL DEFAULT 0,  -- basis points (1000 = 10%)
  default_order_type  TEXT NOT NULL DEFAULT 'takeaway'
                        CHECK (default_order_type IN ('dine_in', 'takeaway')),
  checkout_option     TEXT NOT NULL DEFAULT 'queue_number'
                        CHECK (checkout_option IN ('table_number', 'queue_number', 'none')),
  receipt_header      TEXT,
  receipt_footer      TEXT,
  receipt_logo_url    TEXT,
  ghl_merchant_id     TEXT,
  ghl_terminal_id     TEXT,
  rm_merchant_id      TEXT,                        -- Revenue Monster (matches Pickup)
  rm_client_id        TEXT,
  rm_is_production    BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Payment Gateway Config ────────────────────────────────
-- Matches Pickup payment_gateway_config

CREATE TABLE payment_gateway_config (
  method_id  TEXT PRIMARY KEY,                    -- 'ghl_terminal','fpx','tng','grabpay','boost','card'
  enabled    BOOLEAN NOT NULL DEFAULT false,
  provider   TEXT NOT NULL DEFAULT 'ghl',         -- 'ghl','revenue_monster','stripe'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO payment_gateway_config (method_id, enabled, provider) VALUES
  ('ghl_terminal', true,  'ghl'),
  ('fpx',          false, 'revenue_monster'),
  ('tng',          true,  'revenue_monster'),
  ('grabpay',      true,  'revenue_monster'),
  ('boost',        false, 'revenue_monster'),
  ('card',         true,  'ghl')
ON CONFLICT (method_id) DO NOTHING;

-- ─── Shifts ────────────────────────────────────────────────

CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  register_id   UUID NOT NULL REFERENCES registers(id),
  opened_by     UUID NOT NULL REFERENCES staff_users(id),
  closed_by     UUID REFERENCES staff_users(id),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,
  total_sales   INTEGER NOT NULL DEFAULT 0,       -- sen
  total_orders  INTEGER NOT NULL DEFAULT 0,
  total_refunds INTEGER NOT NULL DEFAULT 0        -- sen
);

-- ─── Orders ────────────────────────────────────────────────
-- The core business event. Matches Pickup orders schema shape.
-- All amounts in SEN.

CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number           TEXT UNIQUE NOT NULL,
  branch_id              UUID NOT NULL REFERENCES branches(id),
  register_id            UUID REFERENCES registers(id),
  shift_id               UUID REFERENCES shifts(id),
  employee_id            UUID REFERENCES staff_users(id),
  source                 TEXT NOT NULL DEFAULT 'pos'
                           CHECK (source IN ('pos', 'pickup', 'qr_dine_in', 'delivery')),
  order_type             TEXT NOT NULL DEFAULT 'takeaway'
                           CHECK (order_type IN ('dine_in', 'takeaway')),
  status                 TEXT NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'sent_to_kitchen', 'ready', 'completed', 'cancelled', 'failed')),
  table_number           TEXT,
  queue_number           TEXT,
  subtotal               INTEGER NOT NULL DEFAULT 0,
  sst_amount             INTEGER NOT NULL DEFAULT 0,
  service_charge         INTEGER NOT NULL DEFAULT 0,
  discount_amount        INTEGER NOT NULL DEFAULT 0,
  rounding_amount        INTEGER NOT NULL DEFAULT 0,
  total                  INTEGER NOT NULL DEFAULT 0,
  customer_phone         TEXT,
  customer_name          TEXT,
  loyalty_phone          TEXT,
  loyalty_points_earned  INTEGER NOT NULL DEFAULT 0,
  reward_id              TEXT,
  reward_name            TEXT,
  reward_discount_amount INTEGER NOT NULL DEFAULT 0,
  voucher_code           TEXT,
  cancellation_reason    TEXT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Order Items ───────────────────────────────────────────

CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL,
  product_name        TEXT NOT NULL,
  variant_id          UUID,
  variant_name        TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price          INTEGER NOT NULL,            -- sen
  modifiers           JSONB NOT NULL DEFAULT '[]',
  modifier_total      INTEGER NOT NULL DEFAULT 0,  -- sen
  discount_amount     INTEGER NOT NULL DEFAULT 0,
  tax_amount          INTEGER NOT NULL DEFAULT 0,
  item_total          INTEGER NOT NULL,             -- sen
  notes               TEXT,
  kitchen_station     TEXT,
  kitchen_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (kitchen_status IN ('pending', 'preparing', 'done')),
  sent_to_kitchen_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Order Payments ────────────────────────────────────────

CREATE TABLE order_payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,                    -- 'card','ghl_terminal','tng','grabpay', etc.
  provider       TEXT,                             -- 'ghl','revenue_monster','stripe'
  amount         INTEGER NOT NULL,                 -- sen
  provider_ref   TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  refund_amount  INTEGER NOT NULL DEFAULT 0,
  refund_reason  TEXT,
  refunded_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ───────────────────────────────────────────────

CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_storehub ON products(storehub_id);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_categories_brand ON product_categories(brand_id);
CREATE INDEX idx_branch_stock_branch ON branch_stock_levels(branch_id);
CREATE INDEX idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_shift ON orders(shift_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_kitchen ON order_items(kitchen_station, kitchen_status);
CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_shifts_branch ON shifts(branch_id, opened_at DESC);
CREATE INDEX idx_staff_branch ON staff_users(branch_id);
CREATE INDEX idx_kitchen_stations_branch ON kitchen_stations(branch_id);

-- ─── Auto-update updated_at trigger ────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Realtime ──────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ─── RLS ───────────────────────────────────────────────────

ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_stock_levels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_codes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments        ENABLE ROW LEVEL SECURITY;

-- Service role full access (API routes use service_role key)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'branches','staff_users','registers','product_categories','products',
    'product_variants','branch_stock_levels','product_recipes','tax_codes',
    'kitchen_stations','branch_settings','payment_gateway_config','shifts',
    'orders','order_items','order_payments'
  ]) LOOP
    EXECUTE format('CREATE POLICY "service_full_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
