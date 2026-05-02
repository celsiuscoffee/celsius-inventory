-- Self-reported HR profile fields. Most of these used to live in BrioHR; we
-- now ask staff to fill them via the staff-app profile page. The reminder
-- banner on the staff home keeps nagging until profile_completed_at is set
-- (or until the staff dismisses it for the session).
--
-- Most fields are *optional* — we ship a soft-required policy where Address
-- + Marital + Race + Religion are encouraged for statutory reporting (EA
-- form & CP8D) but not enforced.
ALTER TABLE hr_employee_profiles
  -- Home address. Stored as discrete fields rather than one blob so we can
  -- print mailing labels and feed the city/state into HRDF demographics.
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_postcode TEXT,
  -- Marital status drives tax relief eligibility (spouse + child reliefs).
  -- Free-text spouse_name is enough; we don't need a full hr_dependents
  -- table for our headcount yet.
  ADD COLUMN IF NOT EXISTS marital_status TEXT,         -- single|married|divorced|widowed
  ADD COLUMN IF NOT EXISTS spouse_name TEXT,
  ADD COLUMN IF NOT EXISTS spouse_working BOOLEAN,      -- both-working flag for joint assessment
  ADD COLUMN IF NOT EXISTS num_children INTEGER,         -- counted toward child relief
  -- Statutory demographic fields. EA form line 4 and CP8D both want race
  -- + religion + nationality. We already had nationality.
  ADD COLUMN IF NOT EXISTS race TEXT,                   -- malay|chinese|indian|bumiputra_other|other
  ADD COLUMN IF NOT EXISTS religion TEXT,
  -- Personal contact channels separate from the user.phone (which is the
  -- login number). Personal_email is what we use for offboarding handoff;
  -- secondary_phone is for emergency-not-emergency-contact reach.
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  -- Education tracked at qualification level only — nobody needs the
  -- school name for our use case, but knowing diploma vs degree helps
  -- with promotion review heuristics.
  ADD COLUMN IF NOT EXISTS education_level TEXT,        -- spm|stpm|diploma|degree|masters|phd|other
  -- Operational fields used by the office.
  ADD COLUMN IF NOT EXISTS t_shirt_size TEXT,           -- XS|S|M|L|XL|XXL — for uniform orders
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT,   -- free text — for office events / ramadan
  -- Self-update tracking. profile_completed_at is set by the staff app's
  -- "I'm done" button (lets us hide the reminder banner). The staff app
  -- bumps profile_self_updated_at on every save so HR can sort by who
  -- actually filled their profile in.
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_self_updated_at TIMESTAMPTZ;

-- Cheap index for the "outstanding profile reminders" query the home page
-- runs to decide whether to show the banner.
CREATE INDEX IF NOT EXISTS hr_employee_profiles_completed_at_idx
  ON hr_employee_profiles (profile_completed_at);
