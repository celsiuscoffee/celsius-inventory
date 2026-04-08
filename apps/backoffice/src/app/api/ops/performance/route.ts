import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/ops/performance
 * Aggregated performance data for ops dashboard.
 * Query params: outletId, userId, from, to
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const outletId = url.searchParams.get("outletId");
  const userId = url.searchParams.get("userId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Default: last 7 days
  const dateFrom = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dateTo = to ? new Date(to) : new Date();

  const checklistWhere: Record<string, unknown> = {
    date: { gte: dateFrom, lte: dateTo },
  };
  if (outletId) checklistWhere.outletId = outletId;
  if (userId) checklistWhere.assignedToId = userId;

  // Get all checklists in range
  const checklists = await prisma.checklist.findMany({
    where: checklistWhere,
    include: {
      sop: { select: { id: true, title: true, category: { select: { name: true } } } },
      outlet: { select: { id: true, code: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
      completedBy: { select: { id: true, name: true } },
      items: {
        select: {
          isCompleted: true,
          photoUrl: true,
          completedAt: true,
        },
      },
    },
  });

  // Aggregate stats
  const totalChecklists = checklists.length;
  const completedChecklists = checklists.filter((c) => c.status === "COMPLETED").length;
  const inProgressChecklists = checklists.filter((c) => c.status === "IN_PROGRESS").length;
  const pendingChecklists = checklists.filter((c) => c.status === "PENDING").length;
  const completionRate = totalChecklists > 0 ? Math.round((completedChecklists / totalChecklists) * 100) : 0;

  // Photo compliance
  const totalItems = checklists.reduce((sum, c) => sum + c.items.length, 0);
  const itemsWithPhotos = checklists.reduce(
    (sum, c) => sum + c.items.filter((i) => i.photoUrl).length, 0
  );
  const photoRate = totalItems > 0 ? Math.round((itemsWithPhotos / totalItems) * 100) : 0;

  // Per-staff breakdown
  const staffMap = new Map<string, {
    id: string; name: string; role: string;
    total: number; completed: number; items: number; completedItems: number; photos: number;
  }>();

  for (const cl of checklists) {
    if (!cl.assignedTo) continue;
    const key = cl.assignedTo.id;
    const existing = staffMap.get(key) || {
      id: cl.assignedTo.id, name: cl.assignedTo.name, role: cl.assignedTo.role,
      total: 0, completed: 0, items: 0, completedItems: 0, photos: 0,
    };
    existing.total++;
    if (cl.status === "COMPLETED") existing.completed++;
    existing.items += cl.items.length;
    existing.completedItems += cl.items.filter((i) => i.isCompleted).length;
    existing.photos += cl.items.filter((i) => i.photoUrl).length;
    staffMap.set(key, existing);
  }

  const staffBreakdown = Array.from(staffMap.values())
    .map((s) => ({
      ...s,
      completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      photoRate: s.items > 0 ? Math.round((s.photos / s.items) * 100) : 0,
    }))
    .sort((a, b) => b.completionRate - a.completionRate);

  // Per-outlet breakdown
  const outletMap = new Map<string, {
    id: string; name: string; code: string;
    total: number; completed: number;
  }>();

  for (const cl of checklists) {
    const key = cl.outlet.id;
    const existing = outletMap.get(key) || {
      id: cl.outlet.id, name: cl.outlet.name, code: cl.outlet.code,
      total: 0, completed: 0,
    };
    existing.total++;
    if (cl.status === "COMPLETED") existing.completed++;
    outletMap.set(key, existing);
  }

  const outletBreakdown = Array.from(outletMap.values())
    .map((o) => ({
      ...o,
      completionRate: o.total > 0 ? Math.round((o.completed / o.total) * 100) : 0,
    }))
    .sort((a, b) => b.completionRate - a.completionRate);

  // Daily trend
  const dailyMap = new Map<string, { date: string; total: number; completed: number }>();
  for (const cl of checklists) {
    const dateKey = new Date(cl.date).toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { date: dateKey, total: 0, completed: 0 };
    existing.total++;
    if (cl.status === "COMPLETED") existing.completed++;
    dailyMap.set(dateKey, existing);
  }
  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Recent incomplete checklists
  const incomplete = checklists
    .filter((c) => c.status !== "COMPLETED")
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      sopTitle: c.sop.title,
      category: c.sop.category.name,
      outlet: c.outlet.name,
      assignedTo: c.assignedTo?.name ?? "Unassigned",
      date: c.date,
      shift: c.shift,
      itemsCompleted: c.items.filter((i) => i.isCompleted).length,
      totalItems: c.items.length,
    }));

  return NextResponse.json({
    summary: {
      totalChecklists,
      completedChecklists,
      inProgressChecklists,
      pendingChecklists,
      completionRate,
      totalItems,
      itemsWithPhotos,
      photoRate,
    },
    staffBreakdown,
    outletBreakdown,
    dailyTrend,
    incomplete,
  });
}
