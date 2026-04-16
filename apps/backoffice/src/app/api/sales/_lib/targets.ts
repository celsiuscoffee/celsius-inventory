/**
 * Active sales targets — DB-backed, AI-set, progressive.
 *
 * Falls back to the hardcoded defaults from storehub-helpers if no
 * AI-set targets exist yet (day 1 behavior).
 */

import { prisma } from "@/lib/prisma";
import { ROUND_TARGETS as DEFAULT_TARGETS, type RoundKey } from "./storehub-helpers";

export type DayType = "weekday" | "weekend";
export type RoundTargetShape = { revenue: number; orders: number; aov: number };

/** Shape: { breakfast: { weekday, weekend }, ... } */
export type ActiveTargets = Record<RoundKey, { weekday: RoundTargetShape; weekend: RoundTargetShape }>;

/** Metadata about the currently-active target set */
export type TargetsMetadata = {
  lastUpdated: string | null;   // ISO timestamp of most recent active row
  source: string;               // 'ai' | 'manual' | 'default'
  reasoning: string | null;
};

const ROUND_KEYS: RoundKey[] = ["breakfast", "brunch", "lunch", "midday", "evening", "dinner", "supper"];

/**
 * Load active targets from DB. For each (round, dayType), take the row with
 * `isActive=true` and the most recent `effectiveFrom`. Gaps fall back to
 * ROUND_TARGETS defaults.
 */
export async function getActiveTargets(): Promise<{ targets: ActiveTargets; meta: TargetsMetadata }> {
  const rows = await prisma.salesTarget.findMany({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });

  // Build map: roundKey+dayType → first (= most recent) matching row
  const byKey = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const key = `${row.roundKey}_${row.dayType}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  // Merge with defaults
  const targets = {} as ActiveTargets;
  for (const round of ROUND_KEYS) {
    const wk = byKey.get(`${round}_weekday`);
    const we = byKey.get(`${round}_weekend`);
    targets[round] = {
      weekday: wk
        ? { revenue: wk.revenue, orders: wk.orders, aov: Number(wk.aov) }
        : DEFAULT_TARGETS[round].weekday,
      weekend: we
        ? { revenue: we.revenue, orders: we.orders, aov: Number(we.aov) }
        : DEFAULT_TARGETS[round].weekend,
    };
  }

  // Metadata from the single most recent row (if any)
  const mostRecent = rows[0];
  const meta: TargetsMetadata = {
    lastUpdated: mostRecent?.effectiveFrom.toISOString() ?? null,
    source: mostRecent?.source ?? "default",
    reasoning: mostRecent?.reasoning ?? null,
  };

  return { targets, meta };
}
