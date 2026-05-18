/**
 * City → Outlet mapping for Indeed Sponsored Jobs.
 *
 * Indeed reports job locations by city/state, not by our outlet IDs.
 * This module resolves an Indeed location string to one of our Outlet
 * rows so per-outlet recruitment spend rolls up cleanly.
 *
 * The 4 operating outlets (as of 2026-05):
 *   Shah Alam  → "Shah Alam, Selangor"
 *   Conezion   → "Putrajaya, Putrajaya"  (IOI City Mall)
 *   Tamarind   → "Cyberjaya, Selangor"
 *   Nilai      → "Nilai, Negeri Sembilan"
 *
 * Lookup is done by Outlet.code so the mapping doesn't break if Outlet
 * UUIDs are reseeded. Codes must exist in the Outlet table — if you add
 * a new outlet, seed it before running the Indeed sync.
 */

import { prisma } from "@/lib/prisma";

const CITY_TO_OUTLET_CODE: Record<string, string> = {
  "shah alam":  "SHAH_ALAM",
  "putrajaya":  "CONEZION",
  "cyberjaya":  "TAMARIND",
  "nilai":      "NILAI",
};

let outletCodeToId: Map<string, string> | null = null;

async function loadOutletCodeMap(): Promise<Map<string, string>> {
  if (outletCodeToId) return outletCodeToId;
  const outlets = await prisma.outlet.findMany({ select: { id: true, code: true } });
  outletCodeToId = new Map(outlets.map(o => [o.code, o.id]));
  return outletCodeToId;
}

/** Reset the in-process cache. Useful for tests or after seeding outlets. */
export function resetOutletMapCache(): void {
  outletCodeToId = null;
}

/**
 * Resolve an Indeed location string to an Outlet.id, or null if no match.
 *
 * Accepts strings in the form "City, State" or "City" (e.g. "Shah Alam,
 * Selangor", "Putrajaya"). Matching is case-insensitive on the city portion.
 */
export async function resolveOutletId(locationCity: string | null | undefined): Promise<string | null> {
  if (!locationCity) return null;
  const cityKey = locationCity.split(",")[0].trim().toLowerCase();
  const code = CITY_TO_OUTLET_CODE[cityKey];
  if (!code) return null;
  const map = await loadOutletCodeMap();
  return map.get(code) ?? null;
}
