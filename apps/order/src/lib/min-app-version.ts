import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Server-side gate against `app_settings.min_app_version`.
 *
 * The pickup-native client sends `X-App-Version` + `X-App-Platform` on
 * every order-create / checkout-initiate request (see lib/api.ts in the
 * pickup-native app). The PWA at order.celsiuscoffee.com sends
 * neither — so this helper soft-skips when the headers are missing,
 * never breaking the web flow.
 *
 * When the configured `forceUpdate` flag is on AND the request's
 * `X-App-Version` is below the configured min for the request's
 * platform, the helper returns a 426 Response that the caller can
 * forward straight to the client. The 426 body carries the configured
 * `min` so the app can decide how to present "please update" without
 * an extra round-trip.
 *
 * Returns:
 *   - `null` if the request is allowed through.
 *   - a `Response` if the request must be rejected. Caller should
 *     `return` it immediately.
 */
export async function requireMinAppVersion(req: NextRequest): Promise<Response | null> {
  const platformHeader = (req.headers.get("x-app-platform") ?? "").toLowerCase();
  const versionHeader  =  req.headers.get("x-app-version") ?? "";

  // PWA + any client that doesn't identify itself is allowed — we can
  // only enforce against builds that opt in by sending the headers.
  if (!platformHeader || !versionHeader) return null;
  if (platformHeader !== "ios" && platformHeader !== "android") return null;

  try {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "min_app_version")
      .maybeSingle();
    const cfg = (row?.value ?? null) as
      | { ios?: string; android?: string; forceUpdate?: boolean }
      | null;
    if (!cfg || cfg.forceUpdate !== true) return null;

    const min = platformHeader === "ios" ? cfg.ios : cfg.android;
    if (!min) return null;

    if (compareSemver(versionHeader, min) < 0) {
      return NextResponse.json(
        {
          error: "Please update Celsius Coffee to the latest version to continue.",
          minVersion: min,
          platform:   platformHeader,
        },
        { status: 426 }, // Upgrade Required
      );
    }
  } catch {
    // Never block traffic on a settings lookup failure — that would
    // hand the database a single-point-of-outage over a soft policy.
  }
  return null;
}

// Numeric semver compare. Returns -1 if a < b, 0 equal, 1 if a > b.
// Handles "1.2.3", trims any pre-release suffix, treats missing parts
// as 0.
function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const core = v.split(/[-+]/)[0] ?? "0";
    return core.split(".").map((n) => Number(n) || 0);
  };
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai < bi) return -1;
    if (ai > bi) return  1;
  }
  return 0;
}
