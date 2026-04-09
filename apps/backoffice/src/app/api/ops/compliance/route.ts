import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/ops/compliance
 * Compare published SOPs' expected frequency against actual schedules per outlet.
 * Returns gaps: missing outlets, under-scheduled, no schedules at all.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [sops, outlets, schedules] = await Promise.all([
    prisma.sop.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true, title: true, expectedRecurrence: true,
        expectedTimesPerDay: true, expectedDueMinutes: true,
        appliesToAllOutlets: true,
        category: { select: { name: true } },
        sopOutlets: { select: { outletId: true } },
      },
    }),
    prisma.outlet.findMany({
      where: { status: "ACTIVE", type: "OUTLET" },
      select: { id: true, name: true, code: true },
    }),
    prisma.sopSchedule.findMany({
      where: { isActive: true },
      select: {
        sopId: true, outletId: true, recurrence: true,
        times: true, assignedToId: true,
      },
    }),
  ]);

  // Build schedule lookup: sopId → outletId → schedule count & times count
  const scheduleMap = new Map<string, Map<string, { count: number; timesCount: number; hasStaff: boolean }>>();
  for (const s of schedules) {
    if (!scheduleMap.has(s.sopId)) scheduleMap.set(s.sopId, new Map());
    const outletMap = scheduleMap.get(s.sopId)!;
    const existing = outletMap.get(s.outletId) || { count: 0, timesCount: 0, hasStaff: false };
    existing.count++;
    existing.timesCount += s.recurrence === "SPECIFIC_TIMES" ? s.times.length : s.recurrence === "HOURLY" ? 14 : 1;
    if (s.assignedToId) existing.hasStaff = true;
    outletMap.set(s.outletId, existing);
  }

  type SopCompliance = {
    sopId: string;
    title: string;
    category: string;
    expectedRecurrence: string;
    expectedTimesPerDay: number;
    appliesToAllOutlets: boolean;
    outlets: {
      outletId: string;
      outletName: string;
      outletCode: string;
      status: "ok" | "warning" | "missing";
      scheduledTimesPerDay: number;
      hasStaff: boolean;
      message: string;
    }[];
    severity: "ok" | "warning" | "critical";
  };

  const results: SopCompliance[] = [];
  let totalGaps = 0;
  let criticalGaps = 0;
  let warningGaps = 0;

  for (const sop of sops) {
    // Determine which outlets this SOP should cover
    const targetOutletIds = sop.appliesToAllOutlets
      ? outlets.map((o) => o.id)
      : sop.sopOutlets.map((so) => so.outletId);

    const outletStatuses: SopCompliance["outlets"] = [];
    let sopSeverity: "ok" | "warning" | "critical" = "ok";

    for (const outletId of targetOutletIds) {
      const outlet = outlets.find((o) => o.id === outletId);
      if (!outlet) continue;

      const schedInfo = scheduleMap.get(sop.id)?.get(outletId);

      if (!schedInfo) {
        outletStatuses.push({
          outletId, outletName: outlet.name, outletCode: outlet.code,
          status: "missing", scheduledTimesPerDay: 0, hasStaff: false,
          message: "Not scheduled",
        });
        sopSeverity = "critical";
        totalGaps++;
        criticalGaps++;
      } else if (schedInfo.timesCount < sop.expectedTimesPerDay) {
        outletStatuses.push({
          outletId, outletName: outlet.name, outletCode: outlet.code,
          status: "warning", scheduledTimesPerDay: schedInfo.timesCount, hasStaff: schedInfo.hasStaff,
          message: `${schedInfo.timesCount}x/day (expected ${sop.expectedTimesPerDay}x)`,
        });
        if (sopSeverity === "ok") sopSeverity = "warning";
        totalGaps++;
        warningGaps++;
      } else {
        outletStatuses.push({
          outletId, outletName: outlet.name, outletCode: outlet.code,
          status: "ok", scheduledTimesPerDay: schedInfo.timesCount, hasStaff: schedInfo.hasStaff,
          message: `${schedInfo.timesCount}x/day`,
        });
      }
    }

    results.push({
      sopId: sop.id,
      title: sop.title,
      category: sop.category.name,
      expectedRecurrence: sop.expectedRecurrence,
      expectedTimesPerDay: sop.expectedTimesPerDay,
      appliesToAllOutlets: sop.appliesToAllOutlets,
      outlets: outletStatuses,
      severity: sopSeverity,
    });
  }

  // Sort: critical first, then warning, then ok
  const severityOrder = { critical: 0, warning: 1, ok: 2 };
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const totalSops = sops.length;
  const coveredSops = results.filter((r) => r.severity === "ok").length;
  const coverageRate = totalSops > 0 ? Math.round((coveredSops / totalSops) * 100) : 0;

  return NextResponse.json({
    summary: {
      totalSops,
      coveredSops,
      coverageRate,
      totalGaps,
      criticalGaps,
      warningGaps,
      totalOutlets: outlets.length,
    },
    sops: results,
  });
}
