import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string; itemId: string }> };

/**
 * PATCH /api/checklists/[id]/items/[itemId]
 * Toggle or update a checklist item
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const body = await req.json();

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, checklistId: id },
  });

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body.isCompleted === "boolean") {
    // Block completion if photo is required but not uploaded
    if (body.isCompleted && item.photoRequired && !item.photoUrl && !body.photoUrl) {
      return NextResponse.json({ error: "Photo is required for this step" }, { status: 400 });
    }
    data.isCompleted = body.isCompleted;
    data.completedById = body.isCompleted ? session.id : null;
    data.completedAt = body.isCompleted ? new Date() : null;
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes;
  }
  if (typeof body.photoUrl === "string") {
    data.photoUrl = body.photoUrl;
  }

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data,
    include: { completedBy: { select: { id: true, name: true } } },
  });

  // Auto-update checklist status based on item completion
  const allItems = await prisma.checklistItem.findMany({
    where: { checklistId: id },
  });
  const completedCount = allItems.filter((i) => i.isCompleted).length;

  let checklistStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  if (completedCount === 0) checklistStatus = "PENDING";
  else if (completedCount === allItems.length) checklistStatus = "COMPLETED";
  else checklistStatus = "IN_PROGRESS";

  await prisma.checklist.update({
    where: { id },
    data: {
      status: checklistStatus,
      completedById: checklistStatus === "COMPLETED" ? session.id : null,
      completedAt: checklistStatus === "COMPLETED" ? new Date() : null,
    },
  });

  return NextResponse.json({ item: updated, checklistStatus });
}
