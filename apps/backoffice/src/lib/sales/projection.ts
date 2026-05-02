// Projection compute for the sales/compare page.
//
// Formula: 7-day moving average × total days in the period.
//
// The MA window is the 7 calendar days ending yesterday (MYT), independent
// of where we are in the period. So a monthly card always projects the
// same way whether we're on day 2 or day 25, and the result reads as the
// straightforward "if the last week keeps repeating, this is the month".
//
// The projection is floored at what's already been booked in the period
// (including today's partial day), so it can never read lower than reality.
//
// Reads from the local SalesTransaction table — no StoreHub round-trip,
// keeps the compare endpoint snappy.

import { prisma } from "@/lib/prisma";

export type ProjectionResult = {
  projected: number;
  projectedOrders: number;
  daysElapsed: number;
  totalDays: number;
  method: string;
};

/** Get today's date in MYT (Malaysia / UTC+8). */
function getMYTToday(): Date {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  myt.setUTCHours(0, 0, 0, 0);
  return myt;
}

/** Convert "YYYY-MM-DD" to a UTC midnight Date. */
function parseISODate(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

/** Format a Date as "YYYY-MM-DD" (UTC). */
function fmtISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Days between two UTC dates, inclusive of both ends. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/** Add `n` days to a UTC date, returning a new Date. */
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Compute a 7-day-MA projection for a period. Returns null when today is
 * outside the period or when there is no MA history to work with.
 */
export async function computeProjection(opts: {
  from: string; // "YYYY-MM-DD" (period start, inclusive)
  to: string;   // "YYYY-MM-DD" (period end, inclusive)
  outletIds: string[];
}): Promise<ProjectionResult | null> {
  const { from, to, outletIds } = opts;
  if (!outletIds.length) return null;

  const today = getMYTToday();
  const fromD = parseISODate(from);
  const toD = parseISODate(to);
  if (today < fromD || today > toD) return null;

  const totalDays = daysBetween(fromD, toD);
  const daysElapsed = daysBetween(fromD, today);
  if (daysElapsed > totalDays) return null;

  // ── 1. 7-day moving average (today-7 → yesterday in MYT) ────────────────
  const maStart = addDays(today, -7);
  const maTxns = await prisma.salesTransaction.findMany({
    where: {
      outletId: { in: outletIds },
      transactedAt: { gte: maStart, lt: today },
    },
    select: { grossAmount: true, quantity: true, transactedAt: true },
  });

  // Bucket by MYT calendar day so we average over distinct days, not over
  // transaction count. A busy Saturday shouldn't outweigh a quiet Monday
  // just because it has more rows.
  const dailyRev = new Map<string, number>();
  const dailyOrd = new Map<string, number>();
  for (const t of maTxns) {
    const myt = new Date(t.transactedAt.getTime() + 8 * 60 * 60 * 1000);
    const dateKey = fmtISODate(myt);
    dailyRev.set(dateKey, (dailyRev.get(dateKey) ?? 0) + Number(t.grossAmount));
    dailyOrd.set(dateKey, (dailyOrd.get(dateKey) ?? 0) + t.quantity);
  }

  const dayCount = dailyRev.size;
  if (dayCount === 0) return null;

  const sumRev = [...dailyRev.values()].reduce((a, b) => a + b, 0);
  const sumOrd = [...dailyOrd.values()].reduce((a, b) => a + b, 0);
  const avgRev = sumRev / dayCount;
  const avgOrd = sumOrd / dayCount;

  let projected = avgRev * totalDays;
  let projectedOrders = avgOrd * totalDays;

  // ── 2. Floor at booked-so-far ──────────────────────────────────────────
  // The MA window can sit entirely before the period (e.g., on day 2 of a
  // month following a hot weekend). If actuals already exceed the MA
  // projection, use the actuals — projection should never read lower than
  // what's in the till.
  const periodTxns = await prisma.salesTransaction.findMany({
    where: {
      outletId: { in: outletIds },
      transactedAt: { gte: fromD, lt: addDays(today, 1) },
    },
    select: { grossAmount: true, quantity: true },
  });
  const periodRev = periodTxns.reduce((s, t) => s + Number(t.grossAmount), 0);
  const periodOrd = periodTxns.reduce((s, t) => s + t.quantity, 0);
  projected = Math.max(projected, periodRev);
  projectedOrders = Math.max(projectedOrders, periodOrd);

  return {
    projected: Math.round(projected * 100) / 100,
    projectedOrders: Math.round(projectedOrders),
    daysElapsed,
    totalDays,
    method: `${dayCount}d MA × ${totalDays}d`,
  };
}
