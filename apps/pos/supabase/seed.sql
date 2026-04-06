-- ==========================================
-- Celsius POS — Seed Data
-- All prices in SEN
-- ==========================================

-- Brand ID (same across all Celsius apps)
-- Using a fixed UUID so it matches Loyalty app's brand
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches WHERE code = 'CC-SA') THEN

    -- Branches
    INSERT INTO branches (id, code, name, branch_type, address, city, state, storehub_id) VALUES
      ('b0000001-0000-0000-0000-000000000001', 'CC-SA',  'Celsius Coffee Shah Alam',    'outlet', 'Shah Alam',          'Shah Alam',  'Selangor',  'shah-alam'),
      ('b0000002-0000-0000-0000-000000000002', 'CC-IOI', 'Celsius Coffee IOI Conezion', 'outlet', 'IOI City Mall Conezion', 'Putrajaya', 'Putrajaya', 'conezion'),
      ('b0000003-0000-0000-0000-000000000003', 'CC-TAM', 'Celsius Coffee Tamarind',     'outlet', 'Tamarind Square',    'Cyberjaya',  'Selangor',  'tamarind');

    -- Registers
    INSERT INTO registers (branch_id, name) VALUES
      ('b0000001-0000-0000-0000-000000000001', 'Register 1'),
      ('b0000002-0000-0000-0000-000000000002', 'Register 1'),
      ('b0000003-0000-0000-0000-000000000003', 'Register 1');

    -- Branch Settings
    INSERT INTO branch_settings (branch_id, service_charge_rate, checkout_option) VALUES
      ('b0000001-0000-0000-0000-000000000001', 0, 'queue_number'),
      ('b0000002-0000-0000-0000-000000000002', 0, 'queue_number'),
      ('b0000003-0000-0000-0000-000000000003', 0, 'queue_number');

    -- Staff (PIN: 1234 for all — bcrypt hash)
    INSERT INTO staff_users (brand_id, branch_id, name, role, pin_hash, assigned_branches) VALUES
      ('00000000-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'Ammar', 'admin',   '$2a$10$X7UrH5HOxfQkjEb.vlQvZOQz3GxZ5ZB1yt0ySxAC0.hL9q3UfBZ6W', ARRAY['b0000001-0000-0000-0000-000000000001','b0000002-0000-0000-0000-000000000002','b0000003-0000-0000-0000-000000000003']::UUID[]),
      ('00000000-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'Sarah', 'manager', '$2a$10$X7UrH5HOxfQkjEb.vlQvZOQz3GxZ5ZB1yt0ySxAC0.hL9q3UfBZ6W', ARRAY['b0000001-0000-0000-0000-000000000001']::UUID[]),
      ('00000000-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', 'Ali',   'staff',   '$2a$10$X7UrH5HOxfQkjEb.vlQvZOQz3GxZ5ZB1yt0ySxAC0.hL9q3UfBZ6W', ARRAY['b0000001-0000-0000-0000-000000000001']::UUID[]);

    -- Product Categories
    INSERT INTO product_categories (brand_id, name, slug, sort_order) VALUES
      ('00000000-0000-0000-0000-000000000001', 'Coffee',     'coffee',     1),
      ('00000000-0000-0000-0000-000000000001', 'Non-Coffee', 'non-coffee', 2),
      ('00000000-0000-0000-0000-000000000001', 'Tea',        'tea',        3),
      ('00000000-0000-0000-0000-000000000001', 'Food',       'food',       4),
      ('00000000-0000-0000-0000-000000000001', 'Pastry',     'pastry',     5);

    -- Products (prices in SEN)
    INSERT INTO products (brand_id, name, sku, category, price, cost, tax_rate, kitchen_station, modifiers, is_available) VALUES
      ('00000000-0000-0000-0000-000000000001', 'Iced Latte',       'COF001', 'coffee',     1400, 450, 0, 'Bar',
        '[{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]},{"group_name":"Milk","is_required":false,"min_select":0,"max_select":1,"options":[{"name":"Oat Milk","price":200},{"name":"Soy Milk","price":150}]},{"group_name":"Sugar","is_required":false,"min_select":0,"max_select":1,"options":[{"name":"Less Sugar","price":0},{"name":"No Sugar","price":0}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Hot Latte',        'COF002', 'coffee',     1300, 400, 0, 'Bar',
        '[{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]},{"group_name":"Milk","is_required":false,"min_select":0,"max_select":1,"options":[{"name":"Oat Milk","price":200},{"name":"Soy Milk","price":150}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Americano',        'COF003', 'coffee',     1100, 300, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]},{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Cappuccino',       'COF004', 'coffee',     1400, 450, 0, 'Bar',
        '[{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Mocha',            'COF005', 'coffee',     1600, 500, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]},{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Matcha Latte',     'NCF001', 'non-coffee', 1500, 500, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]},{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]},{"group_name":"Milk","is_required":false,"min_select":0,"max_select":1,"options":[{"name":"Oat Milk","price":200}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Chocolate',        'NCF002', 'non-coffee', 1400, 450, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]},{"group_name":"Size","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Regular","price":0},{"name":"Large","price":200}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Earl Grey',        'TEA001', 'tea',        1000, 250, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Jasmine Green Tea','TEA002', 'tea',        1000, 250, 0, 'Bar',
        '[{"group_name":"Temp","is_required":true,"min_select":1,"max_select":1,"options":[{"name":"Iced","price":0},{"name":"Hot","price":0}]}]',
        true),
      ('00000000-0000-0000-0000-000000000001', 'Chicken Sandwich', 'FOD001', 'food',       1800, 700, 0, 'Kitchen',
        '[]', true),
      ('00000000-0000-0000-0000-000000000001', 'Egg Croissant',    'FOD002', 'food',       1500, 600, 0, 'Kitchen',
        '[]', true),
      ('00000000-0000-0000-0000-000000000001', 'Butter Croissant', 'PST001', 'pastry',     900,  350, 0, 'Kitchen',
        '[]', true),
      ('00000000-0000-0000-0000-000000000001', 'Banana Bread',     'PST002', 'pastry',     1000, 400, 0, 'Kitchen',
        '[]', true);

    -- Kitchen Stations
    INSERT INTO kitchen_stations (branch_id, name, sort_order) VALUES
      ('b0000001-0000-0000-0000-000000000001', 'Bar',     1),
      ('b0000001-0000-0000-0000-000000000001', 'Kitchen', 2);

    -- Tax Codes
    INSERT INTO tax_codes (name, code, rate, is_inclusive) VALUES
      ('No Tax',  'NOTAX', 0,   true),
      ('SST 6%',  'SST6',  600, true),
      ('SST 8%',  'SST8',  800, true);

  END IF;
END $$;
