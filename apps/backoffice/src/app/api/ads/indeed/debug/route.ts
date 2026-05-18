import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { indeedFetch } from "@/lib/indeed/client";

export const dynamic = "force-dynamic";

// GET /api/ads/indeed/debug?path=/v1/campaigns
// Returns the raw response from Indeed for inspection.
// Used to figure out the real response shape when sync silently
// returns zero rows.
export async function GET(req: NextRequest) {
  try {
    await requireRole(req.headers, "ADMIN", "OWNER");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "/v1/campaigns";

  try {
    const raw = await indeedFetch<unknown>(path);
    return NextResponse.json({ ok: true, path, raw });
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      path,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
