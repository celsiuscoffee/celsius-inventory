-- Seeds two starter staff-skills audit templates: Barista and Kitchen Crew.
-- Run AFTER 20260508_audit_staff_skills (which adds the auditTarget +
-- jobRoleFilter columns).
--
-- Both templates use ratingType = 'rating_5' since 1–5 produces a useful
-- improvement signal across audits; pass/fail can't show partial growth.
-- jobRoleFilter values match the existing strings in hr_employee_profiles
-- ('Barista' and 'Kitchen Crew'). roleType is the auditor's role
-- (barista_head audits baristas, chef_head audits kitchen).
--
-- Idempotent: skips re-insert if a template with the same name already
-- exists. Safe to run twice. Skipping requires the OWNER lookup to succeed,
-- so this needs at least one OWNER row in the User table.

DO $$
DECLARE
  v_creator_id TEXT;
  v_barista_template_id TEXT;
  v_kitchen_template_id TEXT;
  v_section_id TEXT;
BEGIN
  -- Pick any OWNER as the createdBy. Falls back to first ADMIN, then any
  -- user — defensive in case OWNER role isn't seeded.
  SELECT id INTO v_creator_id FROM "User" WHERE role = 'OWNER' LIMIT 1;
  IF v_creator_id IS NULL THEN
    SELECT id INTO v_creator_id FROM "User" WHERE role = 'ADMIN' LIMIT 1;
  END IF;
  IF v_creator_id IS NULL THEN
    SELECT id INTO v_creator_id FROM "User" LIMIT 1;
  END IF;
  IF v_creator_id IS NULL THEN
    RAISE NOTICE 'No users found, skipping staff-skill template seed.';
    RETURN;
  END IF;

  -- ─── Barista Skills ───────────────────────────────────────────
  SELECT id INTO v_barista_template_id FROM "AuditTemplate"
    WHERE name = 'Barista Skills' AND "auditTarget" = 'STAFF' LIMIT 1;
  IF v_barista_template_id IS NULL THEN
    v_barista_template_id := gen_random_uuid()::text;
    INSERT INTO "AuditTemplate" (id, name, description, "roleType", "auditTarget", "jobRoleFilter", "isActive", version, "createdById", "createdAt", "updatedAt")
    VALUES (
      v_barista_template_id,
      'Barista Skills',
      'Bar station skills audit — espresso, milk, drink prep, hygiene, service.',
      'barista_head',
      'STAFF',
      'Barista',
      TRUE,
      1,
      v_creator_id,
      NOW(),
      NOW()
    );

    -- Section: Espresso
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_barista_template_id, 'Espresso', 0);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Grind setting',     'Adjusted to today''s beans, dialled-in', FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Dose accuracy',     '±0.2g of target dose',                  FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Extraction time',   '25–32s for double shot',                FALSE, 'rating_5', 2),
      (gen_random_uuid()::text, v_section_id, 'Taste check',       'Balanced, no sour/bitter notes',         FALSE, 'rating_5', 3);

    -- Section: Milk
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_barista_template_id, 'Milk', 1);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Steaming texture',  'Microfoam, glossy, no large bubbles',    FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Temperature',       '60–65°C, never scalded',                  FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Latte art',         'Defined pattern, centred',                TRUE,  'rating_5', 2);

    -- Section: Drink Prep
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_barista_template_id, 'Drink Prep', 2);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Recipe accuracy',   'Follows spec for ratio + ingredients',    FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Garnish',           'Correct garnish, fresh',                   FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Presentation',      'Clean cup, no drips, on saucer',           TRUE,  'rating_5', 2),
      (gen_random_uuid()::text, v_section_id, 'Speed',             'Drink ready within target ticket time',    FALSE, 'rating_5', 3);

    -- Section: Cleanliness
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_barista_template_id, 'Cleanliness', 3);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Bar station',       'Clear, organised, no spills',              FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Group heads',       'Backflushed, no coffee residue',           FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Steam wand',        'Wiped after every use, purged',            FALSE, 'rating_5', 2);

    -- Section: Customer Service
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_barista_template_id, 'Customer Service', 4);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Greeting',          'Eye contact, friendly tone, within 5s',    FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Product knowledge', 'Can explain menu, recommend confidently',   FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Handling complaints','Stays calm, resolves or escalates',       FALSE, 'rating_5', 2);

    RAISE NOTICE 'Seeded Barista Skills template (id %)', v_barista_template_id;
  END IF;

  -- ─── Kitchen Crew Skills ──────────────────────────────────────
  SELECT id INTO v_kitchen_template_id FROM "AuditTemplate"
    WHERE name = 'Kitchen Crew Skills' AND "auditTarget" = 'STAFF' LIMIT 1;
  IF v_kitchen_template_id IS NULL THEN
    v_kitchen_template_id := gen_random_uuid()::text;
    INSERT INTO "AuditTemplate" (id, name, description, "roleType", "auditTarget", "jobRoleFilter", "isActive", version, "createdById", "createdAt", "updatedAt")
    VALUES (
      v_kitchen_template_id,
      'Kitchen Crew Skills',
      'Back-of-house skills audit — knife work, cooking, plating, food safety, station setup, speed.',
      'chef_head',
      'STAFF',
      'Kitchen Crew',
      TRUE,
      1,
      v_creator_id,
      NOW(),
      NOW()
    );

    -- Section: Knife Skills
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Knife Skills', 0);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Cut consistency',   'Uniform sizes per spec',                   FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Knife safety',      'Claw grip, knife in safe position',         FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Speed',             'Prep done within station time',             FALSE, 'rating_5', 2);

    -- Section: Cooking Technique
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Cooking Technique', 1);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Temperature control', 'Right heat for the dish, no burning',     FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Doneness',          'Meat / proteins cooked to spec',             FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Consistency',       'Same dish, same result every time',          FALSE, 'rating_5', 2),
      (gen_random_uuid()::text, v_section_id, 'Seasoning',         'Tastes throughout, balanced',                 FALSE, 'rating_5', 3);

    -- Section: Plating
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Plating', 2);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Matches spec',      'Looks like the menu photo',                   TRUE,  'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Cleanliness',       'No smudges, drips on rim',                    FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Garnish placement', 'Correct, fresh',                              FALSE, 'rating_5', 2);

    -- Section: Food Safety
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Food Safety', 3);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Handwashing',       'Washes hands at correct moments',             FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Glove use',         'Changes between raw / cooked / allergen',     FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Temp logs',         'Filled, in-range, signed',                    FALSE, 'rating_5', 2),
      (gen_random_uuid()::text, v_section_id, 'Cross-contamination','Separate boards, no allergen mixing',         FALSE, 'rating_5', 3);

    -- Section: Station Setup
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Station Setup', 4);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Mise en place',     'All prep ready before service',               FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'FIFO rotation',     'Older stock used first, no expired',          FALSE, 'rating_5', 1),
      (gen_random_uuid()::text, v_section_id, 'Labels + dates',    'Containers labelled, prep-dated',             FALSE, 'rating_5', 2);

    -- Section: Speed
    v_section_id := gen_random_uuid()::text;
    INSERT INTO "AuditSection" (id, "templateId", name, "sortOrder")
      VALUES (v_section_id, v_kitchen_template_id, 'Speed', 5);
    INSERT INTO "AuditSectionItem" (id, "sectionId", title, description, "photoRequired", "ratingType", "sortOrder") VALUES
      (gen_random_uuid()::text, v_section_id, 'Ticket time',       'Dishes out within target window',             FALSE, 'rating_5', 0),
      (gen_random_uuid()::text, v_section_id, 'Multi-tasking',     'Handles multiple tickets without errors',     FALSE, 'rating_5', 1);

    RAISE NOTICE 'Seeded Kitchen Crew Skills template (id %)', v_kitchen_template_id;
  END IF;
END $$;
