# Celsius HR — Payroll v1 Spec

**Status:** Draft — approved design decisions locked 2026-04-20
**Goal:** Replace BrioHR for payroll. Feature parity on compute/statutory, substantially better UX via single-screen wizard + AI anomaly detection + auto-prorate from HR data.

---

## 1. Current State (extend, don't rewrite)

| Exists | Location | Status |
|---|---|---|
| Monthly calculator | `apps/backoffice/src/lib/hr/agents/payroll-calculator.ts` | Extend |
| Weekly calculator | `apps/backoffice/src/lib/hr/agents/payroll-calculator-weekly.ts` | Keep — used for part-timers |
| Dashboard UI | `apps/backoffice/src/app/(admin)/hr/payroll/page.tsx` | Rewrite to wizard |
| API | `apps/backoffice/src/app/api/hr/payroll/route.ts` | Extend for cycles |
| Tables | `hr_payroll_runs`, `hr_payroll_items` | Add cycle granularity |

## 2. Design Decisions (LOCKED)

1. **Cycle granularity**
   - **Monthly** for full-time staff
   - **Weekly** for part-timers (separate cycle, same pipeline, same artifacts)
   - Employee's `hr_employee_profiles.payroll_cadence` field drives which calculator runs (`MONTHLY` | `WEEKLY`)

2. **Payslip distribution** — **Staff app only**
   - Payslip PDF stored in Cloudinary, link exposed in Staff app under `/staff/payslips`
   - No WhatsApp / email push (avoid deliverability + opt-out complexity)
   - Staff get an in-app notification + badge when a new payslip is available

3. **Statutory reliefs** — **HR maintains manually in `hr_employee_profiles`**
   - Fields: `personal_relief`, `spouse_relief`, `children_relief`, `lifestyle_relief`, `life_insurance_relief`, etc.
   - No staff-facing "claim reliefs" form in v1
   - HR edits via HR → Employees → [staff] → Edit Profile → Statutory tab

4. **Approval** — **Single-step**
   - OWNER / ADMIN approves → cycle becomes Approved, payslips generated, bank file ready
   - No separate finance gate
   - Bank file execution is manual (finance downloads and uploads to bank portal; marks "Paid" when done)

## 3. Schema Additions

```sql
-- New: payroll cycles
CREATE TABLE hr_payroll_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence text NOT NULL CHECK (cadence IN ('MONTHLY','WEEKLY')),
  period_year int NOT NULL,          -- 2026
  period_month int,                  -- 4 (for MONTHLY); null for WEEKLY
  period_week int,                   -- ISO week (for WEEKLY); null for MONTHLY
  cycle_name text DEFAULT 'Default', -- 'Default' | 'Ad-hoc: Bonus' | etc
  payday date NOT NULL,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','REVIEW','APPROVED','PAID','CLOSED','VOID')),
  total_net_pay decimal(12,2),
  total_employer_cost decimal(12,2),
  total_statutory decimal(12,2),
  employee_count int,
  created_by uuid REFERENCES "User"(id),
  approved_by uuid REFERENCES "User"(id),
  approved_at timestamptz,
  committed_at timestamptz,          -- when bank file was generated / finance marked Paid
  closed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cadence, period_year, COALESCE(period_month, 0), COALESCE(period_week, 0), cycle_name)
);

-- Extend hr_payroll_items
ALTER TABLE hr_payroll_items
  ADD COLUMN cycle_id uuid REFERENCES hr_payroll_cycles(id) ON DELETE CASCADE,
  ADD COLUMN prorate_reason text,           -- 'joiner' | 'resigner' | 'unpaid_leave' | null
  ADD COLUMN prorate_days_worked int,
  ADD COLUMN prorate_days_total int,
  ADD COLUMN anomaly_flags jsonb DEFAULT '[]'::jsonb;

-- Extend hr_employee_profiles
ALTER TABLE hr_employee_profiles
  ADD COLUMN payroll_cadence text DEFAULT 'MONTHLY' CHECK (payroll_cadence IN ('MONTHLY','WEEKLY')),
  -- Statutory reliefs (for PCB calculation)
  ADD COLUMN spouse_relief decimal(10,2) DEFAULT 0,
  ADD COLUMN children_count int DEFAULT 0,
  ADD COLUMN lifestyle_relief decimal(10,2) DEFAULT 0,
  ADD COLUMN life_insurance_relief decimal(10,2) DEFAULT 0,
  ADD COLUMN medical_relief decimal(10,2) DEFAULT 0,
  ADD COLUMN education_relief decimal(10,2) DEFAULT 0;

-- New: payslip artifacts
CREATE TABLE hr_payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES hr_payroll_cycles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "User"(id),
  pdf_url text,                      -- Cloudinary
  viewed_at timestamptz,             -- first view by staff
  created_at timestamptz DEFAULT now(),
  UNIQUE (cycle_id, user_id)
);

CREATE INDEX hr_payroll_cycles_period_idx ON hr_payroll_cycles (cadence, period_year, period_month, period_week);
CREATE INDEX hr_payroll_items_cycle_idx ON hr_payroll_items (cycle_id);
CREATE INDEX hr_payslips_user_idx ON hr_payslips (user_id, created_at DESC);
```

## 4. Malaysian Statutory Formulas (authoritative)

Stored as versioned constants in `apps/backoffice/src/lib/hr/constants/statutory-2026.ts`. Update yearly.

### EPF (KWSP)
- **Employee share**: 11% (age <60), 5.5% (age 60–75), 0% (≥75)
- **Employer share**: 13% (salary ≤ RM 5,000), 12% (> RM 5,000); halved past age 60
- Base: gross wages including allowances, **excluding OT**
- No salary ceiling

### SOCSO (PERKESO — Act 4)
- **Category 1** (Employment Injury + Invalidity): for MY citizens < age 60
- **Category 2** (Employment Injury only): foreign workers + ≥60
- Rates per salary band table (hardcode in constants)
- Salary ceiling: RM 6,000

### EIS (Act 800)
- 0.2% employee + 0.2% employer
- Salary ceiling: RM 6,000
- Age ≤ 60 only

### PCB (Monthly Tax Deduction)
- Use **MTD Formula method** (LHDN), not MTD tables — more accurate
- Chargeable income = annual gross − EPF (capped RM 4,000) − reliefs
- Apply tiered rates per 2026 LHDN schedule
- Reliefs applied: personal RM 9,000 + fields from `hr_employee_profiles` (spouse, children, lifestyle, etc.)

### HRDF (PSMB)
- 1% of total wages, employer-only
- Only if ≥ 10 staff (Celsius qualifies)
- Excludes OT

## 5. Prorate Rules

**Triggers (check in order on each employee):**
1. `joined_at` falls within cycle period → prorate from join date to `cycle_end`
2. `resigned_at` falls within cycle period → prorate from `cycle_start` to resign date
3. Approved unpaid leave days within cycle period → deduct those days from `days_worked`

**Formula:** `component × (days_worked / days_in_cycle)`, **calendar-day based**.

**What prorates vs not:**
| Component | Prorates? |
|---|---|
| Basic salary | Yes |
| Fixed allowances (attendance, transport) | Yes |
| Variable allowances (OT, commission) | No — actual only |
| One-off bonuses | No — full amount |
| Deductions (EPF/SOCSO/EIS/PCB) | Recomputed on prorated gross |

Store on `hr_payroll_items`: `prorate_reason`, `prorate_days_worked`, `prorate_days_total` so payslip shows inline:
> *"Salary prorated: RM 1,700 × 15/31 days based on resignation date 15 Mar 2026"*

## 6. UX — Single-Screen Wizard

**Replace BrioHR's 4-modal flow** (Dashboard → cycle modal → checklist → confirm → history). One page at `/hr/payroll/run?cycle={id}`, three panes stacked vertically, no modals.

```
┌─ PANE 1: CYCLE SETUP ─────────────────────────────┐
│  Cadence [Monthly ▾]  Period [April 2026 ▾]       │
│  Cycle [Default ▾]  + New ad-hoc cycle            │
│  Payday [03/05/2026]  Period [01/04 → 30/04]      │
│  Pipeline: ● Draft → ○ Review → ○ Approved → ○ Paid│
└───────────────────────────────────────────────────┘
┌─ PANE 2: EMPLOYEES (25) ──────────────────────────┐
│  [Search] [Dept ▾] [Outlet ▾]  "All included" ☑   │
│  ┌─────────────┬────────┬────────┬────────┬─────┐ │
│  │ Employee    │ Basic  │ Status │ Prorate│ Net │ │
│  │ Izzah N.    │ 822.58 │ ⚠ New  │ 15d    │ 812 │ │
│  │ Ariff Izham │ 10,500 │ OK     │ —      │8,249│ │
│  └─────────────┴────────┴────────┴────────┴─────┘ │
└───────────────────────────────────────────────────┘
┌─ PANE 3: ANOMALIES & TOTALS ──────────────────────┐
│  ⚠ 3 anomalies detected                           │
│   • Ariff Izham: net pay +42% vs March (OT spike) │
│   • 2 employees missing bank details → [Fix ↗]   │
│   • HRDF not accrued this cycle → [Review rule]   │
│                                                    │
│  Totals                                            │
│   Gross: RM 67,661   Net: RM 58,431                │
│   Employer cost: RM 76,983  Statutory: RM 8,203    │
│                                                    │
│  [Save Draft]              [Approve & Generate →] │
└───────────────────────────────────────────────────┘
```

**Per-employee drawer** — click row → slide-in from right (does NOT navigate away):
- Structure: Basic → Additions → Gross → Deductions → Net
- Prorate math **always visible** when applicable (not tooltip)
- "Recompute" button per row after HR edits

## 7. AI Anomaly Detection

Runs at Review stage. Deterministic scoring, not LLM.

| Flag | Condition | Severity | Action |
|---|---|---|---|
| `mom_spike` | Item > ±20% vs prior cycle | Warning | Dismiss with reason |
| `missing_bank` | `bankAccountNumber` null | **Block** approve | Deep-link to staff profile |
| `missing_ot_history` | Zero OT but staff had OT last 3 cycles | Warning | Flag possible missed clock-ins |
| `resignation_not_prorated` | `resigned_at` set but `prorate_reason` null | **Block** approve | Recompute required |
| `statutory_deviation` | Computed EPF ≠ expected % (±RM 2) | Warning | Data issue — flag for review |
| `negative_net` | Net pay < 0 | **Block** approve | Deduction exceeds gross |

## 8. Artifacts (generated on Approve)

| Artifact | Format | Source |
|---|---|---|
| Payroll Report | PDF | Client-side render from cycle data |
| Variance Report (vs prev cycle) | PDF | Computed diff |
| Payslip per employee | PDF → Cloudinary → `hr_payslips.pdf_url` | One per user |
| Bank File (Maybank M2E) | TXT | Generated on "Ready to Pay" action |
| Statutory Bundle (zip) | PCB + EPF + SOCSO + EIS text files | **One-click download** |
| GL Report | CSV (for Bukku integration) | Optional — on demand |

## 9. Staff App — Payslip Viewing

New page: `/staff/payslips`

- List: all payslips for current user, newest first
- Each row: period, cycle name, net pay, [View PDF] button
- Opening a payslip stamps `hr_payslips.viewed_at`
- In-app badge on Home tab when a new payslip is available (not yet viewed)

No push notification, no WhatsApp, no email — per decision #2.

## 10. Status Ladder

```
Draft → Review → Approved → Paid → Closed
  ●       ●         ○         ○       ○
```

- **Draft**: HR editing cycle setup, employee selection
- **Review**: Calculator ran, anomalies surfaced, HR reviewing
- **Approved**: Locked amounts, payslips generated, bank file downloadable
- **Paid**: Finance confirmed bank transfer complete (manual button)
- **Closed**: Statutory submissions filed, cycle immutable

**Reopen** Closed → Approved: admin-only, audit log entry required.

## 11. Implementation Phases

### Phase A — Core Compute (~1.5 weeks)
- Schema migration (cycles table, profile extensions, payslips table)
- Extend `payroll-calculator.ts` to accept `cycle_id` context
- Prorate logic implementation (joiner / resigner / unpaid leave)
- Statutory constants file for 2026
- PCB formula method implementation
- Anomaly detection rules
- Unit tests: prorate scenarios, EPF/SOCSO/EIS/PCB/HRDF against known good values

### Phase B — Single-Screen Wizard (~1 week)
- Rewrite `/hr/payroll/run` as three-pane layout
- Employee drawer component with live recompute
- Anomaly banner with inline fix links
- Status progress bar
- Ad-hoc cycle creation flow

### Phase C — Artifacts + Staff Distribution (~1 week)
- PDF payslip template (React PDF or similar)
- Payroll report PDF
- Variance report (MoM diff)
- Maybank M2E bank file format
- Statutory bundle zip endpoint
- Staff app `/staff/payslips` page

**Total: ~3.5 weeks** to replace BrioHR end-to-end.

## 12. Non-Goals (v1)

- No PRS (Private Retirement Scheme) contributions — add later if staff opt in
- No zakat deduction — add later
- No Form E / CP8D annual forms — Phase D
- No multi-company payroll — single entity (Celsius Coffee Sdn. Bhd.)
- No staff-facing relief claim portal — HR maintains reliefs manually

## 14. Part-Timer Payroll (Weekly)

Separate flow optimized for finance speed. Zero typing — everything pulled from attendance.

### Compute logic (hourly / per-shift)
```
regular_hours = sum(attendance where overtime_hours = 0, during cycle)
ot_hours      = sum(floor(attendance.overtime_hours))   -- floor per OT policy

Pay = regular_hours × hourly_rate
    + ot_hours × hourly_rate × ot_multiplier  (1.5× weekday / 2× rest / 3× PH)
    + approved_claims_this_week
    − advances_taken_this_week
```

### Schema additions
```sql
ALTER TABLE hr_employee_profiles
  ADD COLUMN hourly_rate decimal(8,2),
  ADD COLUMN ot_multiplier_weekday decimal(3,2) DEFAULT 1.5,
  ADD COLUMN ot_multiplier_rest_day decimal(3,2) DEFAULT 2.0,
  ADD COLUMN ot_multiplier_public_holiday decimal(3,2) DEFAULT 3.0,
  ADD COLUMN shift_flat_rate decimal(8,2),
  ADD COLUMN statutory_applicable boolean DEFAULT false,
  ADD COLUMN week_start_day int DEFAULT 1;  -- Mon=1
```

### Finance UX — single table, one approve button

Route: `/hr/payroll/weekly` (distinct from monthly wizard).

Columns: Staff | Reg hrs | OT hrs | Rate | Reg pay | OT pay | Total
Per-row anomaly flags (low hours, high OT, no-show).
Drawer on click: shift-by-shift breakdown.

Target: **3–5 minutes to process 25 part-timers** when no anomalies.

### Statutory toggle
`hr_employee_profiles.statutory_applicable` — defaults `false` (casual worker).
When true: apply monthly EPF/SOCSO/EIS formulas to weekly wage; contributions aggregate to monthly submission files.

### Finance weekly workflow
1. Monday → open `/hr/payroll/weekly`
2. Page defaults to previous Mon–Sun, auto-populated from attendance
3. Scan totals, dismiss anomalies
4. **Approve & Pay** → bank file + payslips generated
5. Upload bank file to Maybank M2E
6. **Mark Paid**

### Integration with main spec
- Same `hr_payroll_cycles` table (`cadence='WEEKLY'`, `period_week=X`)
- Same `hr_payslips` table
- Same bank file format (Maybank M2E)
- Same anomaly engine (different rule set)
- Staff app `/staff/payslips` shows both monthly and weekly in one list

### Part-timer-specific open questions
1. Cycle cutoff: Mon 00:00 MYT default?
2. OT multipliers: 1.5 / 2 / 3 correct?
3. Advances: tracked where? Skip for v1 if not used.
4. Public holiday detection via existing holidays table → auto 3× rate?

## 13. Open Questions / Risks

- **Maybank M2E format** — need to pull exact spec from Maybank docs before Phase C
- **PCB formula reference** — verify against 2026 LHDN gazette; last year's rates may change
- **Weekly cycles for part-timers** — clarify: does each part-timer always run weekly, or can finance override for one-off monthly pay?
- **Bank file for part-timers** — if weekly, we generate 4–5 bank files per month; acceptable?
