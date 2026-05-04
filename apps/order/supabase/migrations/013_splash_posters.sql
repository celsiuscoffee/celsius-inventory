-- ==========================================
-- Splash posters
-- Full-screen promo image shown on app launch
-- (Luckin / Starbucks pattern). One active poster
-- per brand at a time; admins manage from backoffice.
-- ==========================================

CREATE TABLE IF NOT EXISTS splash_posters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    TEXT NOT NULL DEFAULT 'brand-celsius',

  -- Display
  image_url   TEXT NOT NULL,
  title       TEXT,                    -- internal admin label (not shown)
  deeplink    TEXT,                    -- optional: tap target. e.g. /menu, /menu/[productId]
  duration_ms INTEGER NOT NULL DEFAULT 2500,

  -- Scheduling — admin can pre-schedule a campaign
  active      BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at   TIMESTAMPTZ,             -- nullable = active immediately
  ends_at     TIMESTAMPTZ,             -- nullable = no end

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For looking up the current active poster on app launch
CREATE INDEX IF NOT EXISTS idx_splash_posters_lookup
  ON splash_posters (brand_id, active, starts_at, ends_at);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION trg_splash_posters_touch() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS splash_posters_touch ON splash_posters;
CREATE TRIGGER splash_posters_touch
  BEFORE UPDATE ON splash_posters
  FOR EACH ROW EXECUTE FUNCTION trg_splash_posters_touch();
