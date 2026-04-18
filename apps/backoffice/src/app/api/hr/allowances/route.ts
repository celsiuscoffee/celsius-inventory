import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAllowancesForUser, loadAllowanceRules } from "@/lib/hr/allowances";

export const dynamic = "force-dynamic";

// GET /api/hr/allowances?year=2026&month=4&userId=xxx&outletId=yyy
// - userId provided → single-user breakdown
// - otherwise: list all staff (scheduled) with summary amounts
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const userId = searchParams.get("userId");
  const outletId = searchParams.get("outletId");

  const rules = await loadAllowanceRules();

  // Single user — full breakdown
  if (userId) {
    // Staff can only see their own
    if (userId !== session.id && !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const breakdown = await computeAllowancesForUser(userId, year, month, rules);
    return NextResponse.json({ breakdown, rules });
  }

  // List all — admin only
  if (!["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["STAFF", "MANAGER"] },
      ...(outletId ? { OR: [{ outletId }, { outletIds: { has: outletId } }] } : {}),
    },
    select: { id: true, name: true, fullName: true, outletId: true, outlet: { select: { name: true } } },
  });

  // Compute in parallel but cap concurrency
  const results = await Promise.all(
    users.map((u) => computeAllowancesForUser(u.id, year, month, rules).then((b) => ({
      userId: u.id,
      name: u.name,
      fullName: u.fullName,
      outletName: u.outlet?.name || null,
      employmentType: b.employmentType,
      isFullTime: b.isFullTime,
      attendanceEarned: b.attendance.earned,
      attendanceBase: b.attendance.base,
      performanceEarned: b.performance.earned,
      performanceBase: b.performance.base,
      performanceScore: b.performance.score,
      performanceEligible: b.performance.eligible,
      reviewPenaltyTotal: b.reviewPenalty.total,
      totalEarned: b.totalEarned,
      totalMax: b.totalMax,
      lateCount: b.attendance.metrics.lateCount,
      absentCount: b.attendance.metrics.absentCount,
    }))),
  );

  return NextResponse.json({
    period: { year, month },
    rules,
    staff: results.sort((a, b) => b.totalEarned - a.totalEarned),
  });
}
