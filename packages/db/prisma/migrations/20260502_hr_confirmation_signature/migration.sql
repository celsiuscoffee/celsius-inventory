-- Add a path to the signatory's signature PNG so confirmation letters can be
-- e-signed in-app (instead of the legacy "download → print → sign → scan →
-- re-upload" loop). The PNG itself lives in the hr-documents bucket under
-- _company/<file>.png; this column just tracks where.
ALTER TABLE hr_company_settings
  ADD COLUMN IF NOT EXISTS confirmation_signature_path TEXT;
