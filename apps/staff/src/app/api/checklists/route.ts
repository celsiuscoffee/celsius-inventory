import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/checklists
 * List checklists with filters: outletId, date, shift, status
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const outletId = url.searchParams.get("outletId");
  const date = url.searchParams.get("date");
  const shift = url.searchParams.get("shift");
  const status = url.searchParams.get("status");
  const assignedToId = url.searchParams.get("assignedToId");
  const mine = url.searchParams.get("mine");

  const where: Record<string, unknown> = {};
  if (outletId) where.outletId = outletId;
  if (shift) where.shift = shift;
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (mine === "true") where.assignedToId = session.id;
  if (date) {
    const d = new Date(date);
    where.date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const checklists = await prisma.checklist.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      sop: { select: { id: true, title: true, category: { select: { name: true } } } },
      outlet: { select: { id: true, code: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      items: { select: { isCompleted: true } },
    },
  });

  // Add completion stats
  const result = checklists.map((cl) => {
    const totalItems = cl.items.length;
    const completedItems = cl.items.filter((i) => i.isCompleted).length;
    const { items: _items, ...rest } = cl;
    return {
      ...rest,
      totalItems,
      completedItems,
      progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
