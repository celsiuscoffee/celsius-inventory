import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const body = await req.json();

  try {
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.checklistItem.findFirst({
      where: { id: itemId, checklistId: id },
    });
    if (!item) throw new Error("NOT_FOUND");

    // Outlet scope check — staff may only interact with checklists for their
    // own outlet. OWNER/ADMIN bypass.
    const checklist = await tx.checklist.findUnique({
      where: { id },
      select: { assignedToId: true, outletId: true },
    });
    if (!checklist) throw new Error("NOT_FOUND");
    const isAdmin = session.role === "OWNER" || session.role === "ADMIN";
    if (!isAdmin && checklist.outletId !== session.outletId) {
      throw new Error("WRONG_OUTLET");
    }

    // Auto-claim: if checklist is unassigned, assign to current user on first interaction
    if (!checklist.assignedToId) {
      await tx.checklist.update({ where: { id }, data: { assignedToId: session.id } });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.isCompleted === "boolean") {
      if (body.isCompleted && item.photoRequired && !item.photoUrl && !body.photoUrl) {
        throw new Error("PHOTO_REQUIRED");
      }
      data.isCompleted = body.isCompleted;
      data.completedById = body.isCompleted ? session.id : null;
      data.completedAt = body.isCompleted ? new Date() : null;
    }
    if (typeof body.notes === "string") data.notes = body.notes;
    // photoUrl: string → upload/replace, null → remove
    if (body.photoUrl === null) {
      data.photoUrl = null;
      // If the item was only completed because of the photo (photoRequired),
      // revert completion when the photo is removed.
      if (item.photoRequired && item.isCompleted && body.isCompleted !== true) {
        data.isCompleted = false;
        data.completedById = null;
        data.completedAt = null;
      }
    } else if (typeof body.photoUrl === "string") {
      data.photoUrl = body.photoUrl;
      // Auto-tick completion when a photo is uploaded to a photo-required
      // item that isn't already completed (saves a second tap for staff).
      if (item.photoRequired && !item.isCompleted && body.isCompleted !== false) {
        data.isCompleted = true;
        data.completedById = session.id;
        data.completedAt = new Date();
      }
    }

    const updated = await tx.checklistItem.update({
      where: { id: itemId },
      data,
    });

    // Count completed items efficiently
    const [total, done] = await Promise.all([
      tx.checklistItem.count({ where: { checklistId: id } }),
      tx.checklistItem.count({ where: { checklistId: id, isCompleted: true } }),
    ]);
    const checklistStatus = done === 0 ? "PENDING" : done === total ? "COMPLETED" : "IN_PROGRESS";

    await tx.checklist.update({
      where: { id },
      data: {
        status: checklistStatus as "PENDING" | "IN_PROGRESS" | "COMPLETED",
        completedById: checklistStatus === "COMPLETED" ? session.id : null,
        completedAt: checklistStatus === "COMPLETED" ? new Date() : null,
      },
    });

    return { item: updated, checklistStatus };
  });

  return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (msg === "PHOTO_REQUIRED") return NextResponse.json({ error: "Photo is required for this step" }, { status: 400 });
    if (msg === "WRONG_OUTLET") return NextResponse.json({ error: "Checklist belongs to another outlet" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
