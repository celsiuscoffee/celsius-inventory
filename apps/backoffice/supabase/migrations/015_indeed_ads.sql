-- ─────────────────────────────────────────────────────────────────────
-- Indeed Sponsored Jobs — recruitment ad spend tracking.
--
-- Mirrors the Google Ads schema (ads_account / ads_campaign /
-- ads_metric_daily) but specialised for Indeed's data shape:
--   - one Indeed Employer account per company (no MCC)
--   - sponsored "jobs" are the granular unit (each job lives in a
--     campaign and has a single location string from Indeed)
--   - per-job per-day metrics: impressions, clicks, apply starts,
--     applies, spend (USD — Indeed bills in USD even for MY accounts)
--
-- Outlet attribution is done at read time via the city → outlet map
-- in src/lib/indeed/outlet-map.ts. We keep raw Indeed location strings
-- here so the mapping is auditable.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.indeed_ads_job (
  id              TEXT PRIMARY KEY,                      -- our UUID
  indeed_job_id   TEXT NOT NULL,                         -- Indeed's jobKey
  campaign_id     TEXT,                                  -- Indeed campaignId (nullable: "Jobs not in a campaign")
  campaign_name   TEXT,
  title           TEXT NOT NULL,                         -- "Barista", "Kitchen Crew", etc.
  location_city   TEXT,                                  -- "Putrajaya", "Shah Alam", "Nilai", "Cyberjaya"
  location_state  TEXT,
  outlet_id       TEXT REFERENCES public."Outlet"(id) ON DELETE SET NULL,
  status          TEXT,                                  -- OPEN | PAUSED | CLOSED
  premium         BOOLEAN NOT NULL DEFAULT false,        -- Indeed "Premium" sponsorship tier
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (indeed_job_id)
);

CREATE INDEX IF NOT EXISTS indeed_ads_job_outlet_idx     ON public.indeed_ads_job (outlet_id);
CREATE INDEX IF NOT EXISTS indeed_ads_job_campaign_idx   ON public.indeed_ads_job (campaign_id);
CREATE INDEX IF NOT EXISTS indeed_ads_job_city_idx       ON public.indeed_ads_job (location_city);

CREATE TABLE IF NOT EXISTS public.indeed_ads_metric_daily (
  id               TEXT PRIMARY KEY,
  date             DATE NOT NULL,
  job_id           TEXT NOT NULL REFERENCES public.indeed_ads_job(id) ON DELETE CASCADE,
  impressions      BIGINT  NOT NULL DEFAULT 0,
  clicks           BIGINT  NOT NULL DEFAULT 0,
  apply_starts     BIGINT  NOT NULL DEFAULT 0,
  applies          BIGINT  NOT NULL DEFAULT 0,
  spend_usd        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_per_click   NUMERIC(10, 4),
  cost_per_apply   NUMERIC(10, 4),
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, job_id)
);

CREATE INDEX IF NOT EXISTS indeed_ads_metric_daily_date_idx     ON public.indeed_ads_metric_daily (date DESC);
CREATE INDEX IF NOT EXISTS indeed_ads_metric_daily_job_date_idx ON public.indeed_ads_metric_daily (job_id, date DESC);

CREATE TABLE IF NOT EXISTS public.indeed_ads_sync_log (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                           -- "jobs" | "metrics" | "all"
  status        TEXT NOT NULL,                           -- "ok" | "error"
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  rows_upserted INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS indeed_ads_sync_log_started_idx ON public.indeed_ads_sync_log (started_at DESC);
