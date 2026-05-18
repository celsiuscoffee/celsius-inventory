import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncIndeed } from "@/lib/indeed/sync-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manual Indeed sync trigger from /ads/recruitment.
// Body: { days?: number }  — defaults to 30
export async function POST(req: NextRequest) {
  try {
    await requireRole(req.headers, "ADMIN");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { days?: number };
  const days = body.days ?? 30;

  const to   = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const log = await prisma.indeedAdsSyncLog.create({
    data: { kind: "all", status: "running" },
  });

  try {
    const result = await syncIndeed({ from, to });
    await prisma.indeedAdsSyncLog.update({
      where: { id: log.id },
      data:  {
        status:       "ok",
        finishedAt:   new Date(),
        rowsUpserted: result.jobsUpserted + result.metricsUpserted,
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.indeedAdsSyncLog.update({
      where: { id: log.id },
      data:  { status: "error", finishedAt: new Date(), errorMessage: msg },
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
