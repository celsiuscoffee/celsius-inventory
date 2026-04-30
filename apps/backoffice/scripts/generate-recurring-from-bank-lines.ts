/* eslint-disable @typescript-eslint/no-require-imports */
// Generate per-outlet RecurringExpense entries from bank-line history.
//
// Why: the 4 manual HQ aggregates ("Rent (HQ aggregate) RM 15k") generalize
// across outlets and don't reflect actual per-outlet payment patterns.
// This script analyzes the last 90 days of classified bank lines, groups
// them by (outletId, category, month), and emits one RecurringExpense per
// (outlet, category) with:
//   - amount = average monthly total for that outlet+category
//   - nextDueDate = next occurrence at the most-recent day-of-month
//   - cadence = MONTHLY (only categories with consistent monthly cadence)
//
// Categories considered MONTHLY recurring: RENT, UTILITIES, SOFTWARE,
// EMPLOYEE_SALARY, DIRECTORS_ALLOWANCE, STATUTORY_PAYMENT, COMPLIANCE,
// TAX, MAINTENANCE, LICENSING_FEE, ROYALTY_FEE, BANK_FEE, CFS_FEE,
// LOAN, MANAGEMENT_FEE.
//
// Skipped (not monthly-recurring):
//   - PARTIMER (weekly/bi-weekly — projected via daily rate instead)
//   - STAFF_CLAIM, PETTY_CASH (irregular)
//   - DIGITAL_ADS, KOL, OTHER_MARKETING (variable timing)
//   - CARD/QR/STOREHUB/etc (sales — DOW shaped)
//   - RAW_MATERIALS, DELIVERY (multiple times per week)
//   - OTHER_OUTFLOW, OTHER_INFLOW (catch-all)
//
// Idempotent: drops all existing RecurringExpense rows and rebuilds.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTHLY_CATEGORIES_MAP: Record<string, "RENT" | "UTILITY" | "SAAS" | "PAYROLL_SUPPORT" | "OTHER"> = {
  // Property
  RENT:               "RENT",
  UTILITIES:          "UTILITY",
  SOFTWARE:           "SAAS",
  // Payroll
  EMPLOYEE_SALARY:    "PAYROLL_SUPPORT",
  DIRECTORS_ALLOWANCE:"PAYROLL_SUPPORT",
  STATUTORY_PAYMENT:  "PAYROLL_SUPPORT",
  // Other recurring
  COMPLIANCE:         "OTHER",
  TAX:                "OTHER",
  MAINTENANCE:        "OTHER",
  LICENSING_FEE:      "OTHER",
  ROYALTY_FEE:        "OTHER",
  BANK_FEE:           "OTHER",
  CFS_FEE:            "OTHER",
  LOAN:               "OTHER",
  MANAGEMENT_FEE:     "OTHER",
};

const FRIENDLY_NAME: Record<string, string> = {
  RENT:               "Rent",
  UTILITIES:          "Utilities",
  SOFTWARE:           "Software / SaaS",
  EMPLOYEE_SALARY:    "Salary",
  DIRECTORS_ALLOWANCE:"Directors' allowance",
  STATUTORY_PAYMENT:  "Statutory (EPF/SOCSO)",
  COMPLIANCE:         "Compliance / Legal",
  TAX:                "Tax",
  MAINTENANCE:        "Maintenance",
  LICENSING_FEE:      "Licensing fee",
  ROYALTY_FEE:        "Royalty fee",
  BANK_FEE:           "Bank fees",
  CFS_FEE:            "CFS fee",
  LOAN:               "Loan repayment",
  MANAGEMENT_FEE:     "Management fee",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - 90 * 86_400_000);

  // Pull last 90 days of DR lines in monthly categories
  const lines = await prisma.bankStatementLine.findMany({
    where: {
      direction: "DR",
      isInterCo: false,
      txnDate: { gte: since, lte: today },
      category: { in: Object.keys(MONTHLY_CATEGORIES_MAP) as never },
    },
    select: { txnDate: true, amount: true, category: true, outletId: true, description: true },
  });

  // Group by (outletId | "HQ", bankCategory, year-month)
  type Bucket = { totalAmount: number; lineCount: number; latestDate: Date; latestAmount: number };
  const groups = new Map<string, Bucket>();
  for (const l of lines) {
    const oid = l.outletId ?? "__HQ__";
    const month = `${l.txnDate.getFullYear()}-${String(l.txnDate.getMonth() + 1).padStart(2, "0")}`;
    const key = `${oid}|${l.category}|${month}`;
    const amt = Number(l.amount);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { totalAmount: amt, lineCount: 1, latestDate: l.txnDate, latestAmount: amt });
    } else {
      existing.totalAmount += amt;
      existing.lineCount += 1;
      if (l.txnDate > existing.latestDate) {
        existing.latestDate = l.txnDate;
        existing.latestAmount = amt;
      }
    }
  }

  // Aggregate across months per (outletId, category)
  type CatBucket = {
    outletId: string;
    category: string;
    monthlyTotals: Array<{ month: string; total: number; latestDate: Date; latestAmount: number }>;
  };
  const perCategory = new Map<string, CatBucket>();
  for (const [key, b] of groups.entries()) {
    const [oid, cat, month] = key.split("|");
    const k = `${oid}|${cat}`;
    if (!perCategory.has(k)) {
      perCategory.set(k, { outletId: oid, category: cat, monthlyTotals: [] });
    }
    perCategory.get(k)!.monthlyTotals.push({ month, total: b.totalAmount, latestDate: b.latestDate, latestAmount: b.latestAmount });
  }

  // For each (outletId, category) with >= 2 months of history, emit a
  // RecurringExpense. Skip if only 1 month — could be one-off.
  const outlets = await prisma.outlet.findMany({ select: { id: true, name: true } });
  const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));

  type Emit = {
    name: string;
    category: "RENT" | "UTILITY" | "SAAS" | "PAYROLL_SUPPORT" | "OTHER";
    amount: number;
    cadence: "MONTHLY";
    nextDueDate: Date;
    outletId: string | null;
    notes: string;
  };
  const emits: Emit[] = [];

  for (const cb of perCategory.values()) {
    const months = cb.monthlyTotals;
    if (months.length < 2) continue;     // not yet recurring — skip

    // Average monthly total
    const avgAmount = months.reduce((s, m) => s + m.total, 0) / months.length;
    if (avgAmount < 50) continue;        // ignore tiny noise

    // Day-of-month from the most-recent occurrence (latest among all months)
    const latest = months.reduce((acc, m) => m.latestDate > acc.latestDate ? m : acc);
    const dayOfMonth = latest.latestDate.getDate();

    // Next due date = next occurrence of dayOfMonth strictly after today
    const next = new Date(today.getFullYear(), today.getMonth(), Math.min(28, dayOfMonth));
    if (next <= today) next.setMonth(next.getMonth() + 1);

    const outletId = cb.outletId === "__HQ__" ? null : cb.outletId;
    const outletLabel = outletId ? outletNameById.get(outletId) ?? "outlet" : "HQ";
    const friendly = FRIENDLY_NAME[cb.category] ?? cb.category;
    const recurringCat = MONTHLY_CATEGORIES_MAP[cb.category];

    emits.push({
      name: `${friendly} — ${outletLabel}`,
      category: recurringCat,
      amount: Math.round(avgAmount * 100) / 100,
      cadence: "MONTHLY",
      nextDueDate: next,
      outletId,
      notes: `Auto-generated from bank-line history (${months.length} months, avg over ${months.map((m) => m.month).join(", ")}). Last seen ${ymd(latest.latestDate)} for RM ${latest.latestAmount.toFixed(2)}.`,
    });
  }

  emits.sort((a, b) => (a.outletId ?? "").localeCompare(b.outletId ?? "") || a.category.localeCompare(b.category));

  // Wipe existing entries and rebuild
  const wiped = await prisma.recurringExpense.deleteMany({});
  console.log(`[reset] deleted ${wiped.count} existing RecurringExpense entries`);

  if (emits.length === 0) {
    console.log("No entries to create.");
    await prisma.$disconnect();
    return;
  }

  const created = await prisma.recurringExpense.createMany({
    data: emits.map((e) => ({ ...e, isActive: true })),
  });
  console.log(`[ok] created ${created.count} per-outlet RecurringExpense entries`);

  console.log("\n--- Generated entries ---");
  for (const e of emits) {
    const outletLabel = e.outletId ? (outletNameById.get(e.outletId) ?? e.outletId) : "HQ";
    console.log(`  ${outletLabel.padEnd(28)} | ${e.category.padEnd(15)} | RM ${e.amount.toFixed(2).padStart(10)} | due ${ymd(e.nextDueDate)} | ${e.name}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
