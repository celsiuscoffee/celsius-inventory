-- Payroll v1 schema migration — applied 2026-04-20
-- Additive only. Extends existing hr_payroll_runs / hr_payroll_items /
-- hr_employee_profiles tables and adds hr_payslips.

ALTER TABLE hr_payroll_runs
  ADD COLUMN IF NOT EXISTS cycle_name text DEFAULT 'Default',
  ADD COLUMN IF NOT EXISTS period_week int,
  ADD COLUMN IF NOT EXISTS payday date;

ALTER TABLE hr_payroll_items
  ADD COLUMN IF NOT EXISTS prorate_reason text,
  ADD COLUMN IF NOT EXISTS prorate_days_worked int,
  ADD COLUMN IF NOT EXISTS prorate_days_total int,
  ADD COLUMN IF NOT EXISTS anomaly_flags jsonb DEFAULT '[]'::jsonb;

ALTER TABLE hr_employee_profiles
  ADD COLUMN IF NOT EXISTS payroll_cadence text DEFAULT 'MONTHLY'
    CHECK (payroll_cadence IN ('MONTHLY','WEEKLY')),
  ADD COLUMN IF NOT EXISTS ot_multiplier_weekday numeric(3,2) DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS ot_multiplier_rest_day numeric(3,2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS ot_multiplier_public_holiday numeric(3,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS shift_flat_rate numeric(8,2),
  ADD COLUMN IF NOT EXISTS statutory_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_start_day int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS spouse_relief numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS children_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifestyle_relief numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_insurance_relief numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_relief numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS education_relief numeric(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS hr_payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  pdf_url text,
  viewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (payroll_run_id, user_id)
);

CREATE INDEX IF NOT EXISTS hr_payroll_runs_cycle_idx
  ON hr_payroll_runs (cycle_type, period_year, period_month, period_week);
CREATE INDEX IF NOT EXISTS hr_payslips_user_idx
  ON hr_payslips (user_id, created_at DESC);
