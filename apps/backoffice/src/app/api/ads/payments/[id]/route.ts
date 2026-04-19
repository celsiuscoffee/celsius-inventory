import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireRole(req.headers, "ADMIN");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as {
    action: "mark_paid" | "mark_verified" | "add_pop" | "void" | "update_meta";
    paymentMethod?: string;
    referenceNumber?: string;
    paidAt?: string;
    notes?: string;
    popPhoto?: string; // storage path or telegram file_id
  };

  const existing = await prisma.adsPayment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  switch (body.action) {
    case "mark_paid":
      data.status = "PAID";
      data.paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
      data.paymentMethod = body.paymentMethod ?? existing.paymentMethod;
      data.referenceNumber = body.referenceNumber ?? existing.referenceNumber;
      data.paidByUserId = user.id;
      if (body.notes !== undefined) data.notes = body.notes;
      break;
    case "mark_verified":
      data.status = "VERIFIED";
      break;
    case "void":
      data.status = "VOID";
      break;
    case "add_pop":
      if (!body.popPhoto) return NextResponse.json({ error: "popPhoto required" }, { status: 400 });
      data.popPhotos = [...existing.popPhotos, body.popPhoto];
      break;
    case "update_meta":
      if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;
      if (body.referenceNumber !== undefined) data.referenceNumber = body.referenceNumber;
      if (body.notes !== undefined) data.notes = body.notes;
      break;
  }

  const updated = await prisma.adsPayment.update({ where: { id }, data });

  return NextResponse.json({ id: updated.id, status: updated.status });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req.headers, "ADMIN");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.adsPayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
