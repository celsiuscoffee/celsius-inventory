import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import type { GeofenceZone } from "./types";

/**
 * Load the effective geofence for an outlet.
 *
 * `Outlet` (Prisma) is the single source of truth for lat/lng. The separate
 * `hr_geofence_zones` table used to hold its own coords, which drifted out of
 * sync with the outlet record and caused staff physically at the cafe to be
 * told they were kilometres away. We now always override lat/lng with the
 * outlet's coords when they exist, keeping only name/radius/is_active from
 * the zone row.
 */
export async function getEffectiveGeofence(outletId: string): Promise<GeofenceZone | null> {
  const { data: zone } = await supabase
    .from("hr_geofence_zones")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!zone) return null;

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { lat: true, lng: true },
  });

  if (outlet?.lat != null && outlet?.lng != null) {
    return {
      ...(zone as GeofenceZone),
      latitude: Number(outlet.lat),
      longitude: Number(outlet.lng),
    };
  }

  return zone as GeofenceZone;
}
