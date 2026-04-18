import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runCelsiusOverviewAgent } from "@/lib/ai-agent/celsius-overview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai-agent/celsius-overview
 *
 * Runs the Celsius Coffee AI agent. Either authenticated as OWNER/ADMIN
 * (manual trigger) or invoked by Vercel Cron with the CRON_SECRET bearer.
 *
 * The agent decides what to send and when — if nothing is urgent enough
 * for owner attention, no Telegram message is delivered.
 */
async function handle(req: NextRequest) {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const isCron = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const session = await getSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runCelsiusOverviewAgent();
    return NextResponse.json({
      ok: true,
      generatedAt: result.generatedAt,
      recommendationCount: result.recommendations.length,
      delivered: result.delivered,
      deliveryError: result.deliveryError,
      recommendations: result.recommendations,
    });
  } catch (err) {
    console.error("[ai-agent] run failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
