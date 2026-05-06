-- Member-tag scoping for promotions.
--
-- Lets us run promos like "staff price" or "boss price" without inventing
-- a new tier — tag the member (members.tags already exists) and list the
-- accepted tags on the promotion. Empty array keeps today's behaviour:
-- the promo is open to every member.
--
-- Combines AND-style with tier_id when both are set: a promo with tier_id
-- = Gold and eligible_member_tags = {staff} only fires for Gold members
-- who are also tagged staff.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS eligible_member_tags TEXT[] DEFAULT '{}'::TEXT[];

-- GIN index so the eligibility check (member.tags && promo.eligible_member_tags)
-- stays cheap as the promotions table grows.
CREATE INDEX IF NOT EXISTS promotions_eligible_member_tags_gin
  ON promotions USING GIN (eligible_member_tags);
