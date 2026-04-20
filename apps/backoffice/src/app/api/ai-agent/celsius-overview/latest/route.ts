import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLatestCelsiusOverview } from "@/lib/ai-agent/celsius-overview";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-agent/celsius-overview/latest
 * Returns the most recent cached result without re-running the agent.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cached = await getLatestCelsiusOverview();
  if (!cached) {
    return NextResponse.json({ ok: true, cached: null });
  }
  return NextResponse.json({
    ok: true,
    cached: {
      generatedAt: cached.generatedAt,
      recommendations: cached.recommendations,
      snapshot: cached.snapshot,
    },
  });
}
