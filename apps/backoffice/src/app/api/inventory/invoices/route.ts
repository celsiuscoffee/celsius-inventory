import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      status: true,
      paymentType: true,
      issueDate: true,
      dueDate: true,
      photos: true,
      notes: true,
      order: { select: { orderNumber: true } },
      outlet: { select: { name: true } },
      supplier: { select: { name: true } },
      claimedBy: { select: { name: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  const mapped = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    poNumber: inv.order?.orderNumber ?? "—",
    outlet: inv.outlet.name,
    supplier: inv.supplier.name,
    amount: Number(inv.amount),
    status: inv.status,
    paymentType: inv.paymentType,
    claimedBy: inv.claimedBy?.name ?? null,
    issueDate: inv.issueDate.toISOString().split("T")[0],
    dueDate: inv.dueDate?.toISOString().split("T")[0] ?? null,
    hasPhoto: inv.photos.length > 0,
    photoCount: inv.photos.length,
    notes: inv.notes,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, outletId, supplierId, amount, dueDate, photos, invoiceNumber: customInvNum, paymentType, claimedById } = body;

  // Use custom invoice number or auto-generate
  let invoiceNumber = customInvNum;
  if (!invoiceNumber) {
    const count = await prisma.invoice.count();
    invoiceNumber = `INV-${String(count + 1).padStart(4, "0")}`;
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: orderId || null,
      outletId,
      supplierId,
      amount: amount || 0,
      status: "PENDING",
      paymentType: paymentType || "SUPPLIER",
      claimedById: claimedById || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      photos: photos || [],
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
