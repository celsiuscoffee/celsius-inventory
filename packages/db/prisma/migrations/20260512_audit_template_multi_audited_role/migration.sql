-- Multi-select for AuditTemplate.jobRoleFilter: one template can now cover
-- multiple staff positions (e.g. "Barista Skills" applies to both Barista and
-- Barista Lead). roleType (the auditor) stays as a single text value.
--
-- Two changes:
-- 1. Revert AuditTemplate.roleType from text[] back to text. Earlier migration
--    20260512_audit_template_multi_role converted it; that was on the wrong
--    field. Take the first array element back as the scalar value.
-- 2. Convert AuditTemplate.jobRoleFilter from text → text[]. Existing values
--    are wrapped into a 1-element array; NULL becomes empty array.

-- 1. Revert roleType
DROP INDEX IF EXISTS "AuditTemplate_roleType_idx";

ALTER TABLE "AuditTemplate"
  ALTER COLUMN "roleType" DROP DEFAULT,
  ALTER COLUMN "roleType" TYPE text
    USING CASE
      WHEN "roleType" IS NULL OR array_length("roleType", 1) IS NULL THEN ''
      ELSE "roleType"[1]
    END,
  ALTER COLUMN "roleType" SET NOT NULL;

CREATE INDEX "AuditTemplate_roleType_idx" ON "AuditTemplate" ("roleType");

-- 2. Migrate jobRoleFilter to text[]
ALTER TABLE "AuditTemplate"
  ALTER COLUMN "jobRoleFilter" DROP DEFAULT,
  ALTER COLUMN "jobRoleFilter" TYPE text[]
    USING CASE
      WHEN "jobRoleFilter" IS NULL OR "jobRoleFilter" = '' THEN ARRAY[]::text[]
      ELSE ARRAY["jobRoleFilter"]
    END,
  ALTER COLUMN "jobRoleFilter" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "jobRoleFilter" SET NOT NULL;

CREATE INDEX "AuditTemplate_jobRoleFilter_idx" ON "AuditTemplate" USING GIN ("jobRoleFilter");
