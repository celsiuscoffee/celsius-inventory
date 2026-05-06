-- members.sms_opt_out — was referenced everywhere (admin toggle, /api/loyalty
-- members PATCH, /sms/blast filter, engagement page count) but never actually
-- added to the schema. Saving a member from the admin returned a Supabase
-- "Could not find the 'sms_opt_out' column" error.
--
-- Default false so existing members are reachable until they opt out via
-- a STOP keyword or admin toggle. Partial index keeps the SMS-blast filter
-- (`WHERE sms_opt_out = true`) cheap on large member tables.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS members_sms_opt_out_idx
  ON members (sms_opt_out)
  WHERE sms_opt_out = true;
