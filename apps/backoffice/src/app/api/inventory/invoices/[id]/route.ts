import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, dueDate, amount, photos, invoiceNumber, paymentType, claimedById } = body;

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (amount !== undefined) data.amount = amount;
  if (photos !== undefined) data.photos = photos;
  if (paymentType !== undefined) data.paymentType = paymentType;
  if (claimedById !== undefined) data.claimedById = claimedById || null;

  const invoice = await prisma.invoice.update({
    where: { id },
    data,
  });

  return NextResponse.json(invoice);
}
