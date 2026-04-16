import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveTargets } from "../_lib/targets";

/**
 * GET /api/sales/targets
 * Returns the currently-active per-round targets (weekday + weekend) and
 * metadata (last updated, source, AI reasoning).
 */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targets, meta } = await getActiveTargets();
  return NextResponse.json({ targets, meta });
}
