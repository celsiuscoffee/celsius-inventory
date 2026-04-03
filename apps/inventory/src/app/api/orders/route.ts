import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      notes: true,
      deliveryDate: true,
      sentAt: true,
      approvedAt: true,
      createdAt: true,
      branch: { select: { name: true, code: true } },
      supplier: { select: { id: true, name: true, phone: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          notes: true,
          product: { select: { name: true, sku: true, shelfLifeDays: true, baseUom: true } },
          productPackage: { select: { packageLabel: true, packageName: true } },
        },
      },
      _count: { select: { receivings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    branch: o.branch.name,
    branchCode: o.branch.code,
    supplierId: o.supplier.id,
    supplier: o.supplier.name,
    supplierPhone: o.supplier.phone ?? "",
    status: o.status,
    totalAmount: Number(o.totalAmount),
    notes: o.notes,
    deliveryDate: o.deliveryDate?.toISOString().split("T")[0] ?? null,
    createdBy: o.createdBy.name,
    approvedBy: o.approvedBy?.name ?? null,
    approvedAt: o.approvedAt?.toISOString() ?? null,
    sentAt: o.sentAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      product: i.product.name,
      sku: i.product.sku,
      uom: i.productPackage?.packageLabel ?? i.product.baseUom,
      shelfLifeDays: i.product.shelfLifeDays,
      package: i.productPackage?.packageLabel ?? i.productPackage?.packageName ?? "",
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      notes: i.notes,
    })),
    receivingCount: o._count.receivings,
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { branchId, supplierId, items, notes, deliveryDate } = body;

  const branch = await prisma.branch.findUniqueOrThrow({ where: { id: branchId } });
  const count = await prisma.order.count({ where: { branchId } });
  const orderNumber = `CC-${branch.code}-${String(count + 1).padStart(4, "0")}`;

  const caller = getUserFromHeaders(req.headers);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const totalAmount = items.reduce(
    (sum: number, i: { quantity: number; unitPrice: number }) => sum + i.quantity * i.unitPrice,
    0,
  );

  const order = await prisma.order.create({
    data: {
      orderNumber,
      branchId,
      supplierId,
      status: "DRAFT",
      totalAmount,
      notes: notes || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      createdById: caller.id,
      items: {
        create: items.map((i: { productId: string; productPackageId?: string; quantity: number; unitPrice: number; notes?: string }) => ({
          productId: i.productId,
          productPackageId: i.productPackageId || null,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.quantity * i.unitPrice,
          notes: i.notes || null,
        })),
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      branch: { select: { name: true } },
      supplier: { select: { name: true } },
      items: {
        select: {
          product: { select: { name: true } },
          productPackage: { select: { packageLabel: true } },
          quantity: true,
          unitPrice: true,
          totalPrice: true,
        },
      },
    },
  });

  return NextResponse.json(order, { status: 201 });
}
