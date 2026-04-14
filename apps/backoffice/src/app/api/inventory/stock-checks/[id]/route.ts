import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getUserFromHeaders(req.headers);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const stockCount = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      outlet: true,
      countedBy: true,
      items: {
        include: {
          product: true,
          productPackage: true,
        },
      },
    },
  });
  if (!stockCount) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mapped = {
    id: stockCount.id,
    outlet: stockCount.outlet.name,
    outletCode: stockCount.outlet.code,
    frequency: stockCount.frequency,
    countedBy: stockCount.countedBy.name,
    countDate: stockCount.countDate.toISOString(),
    status: stockCount.status,
    notes: stockCount.notes,
    submittedAt: stockCount.submittedAt?.toISOString() ?? null,
    reviewedAt: stockCount.reviewedAt?.toISOString() ?? null,
    createdAt: stockCount.createdAt.toISOString(),
    items: stockCount.items.map((i) => ({
      id: i.id,
      product: i.product.name,
      sku: i.product.sku,
      package: i.productPackage?.packageLabel ?? i.productPackage?.packageName ?? "",
      expectedQty: i.expectedQty ? Number(i.expectedQty) : null,
      countedQty: i.countedQty ? Number(i.countedQty) : null,
      isConfirmed: i.isConfirmed,
      varianceReason: i.varianceReason,
    })),
  };

  return NextResponse.json(mapped);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getUserFromHeaders(req.headers);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, items } = body as {
    status?: string;
    items?: { id: string; varianceReason?: string | null }[];
  };

  // Update variance reasons per item (from manager review)
  if (items && Array.isArray(items)) {
    await Promise.all(
      items.map((item) =>
        prisma.stockCountItem.update({
          where: { id: item.id },
          data: { varianceReason: item.varianceReason || null },
        })
      )
    );
  }

  // Update stock count status
  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "REVIEWED") {
      data.reviewedAt = new Date();
      // TODO: add reviewedById field to schema for full audit trail
    }
  }

  const stockCount = Object.keys(data).length > 0
    ? await prisma.stockCount.update({ where: { id }, data })
    : await prisma.stockCount.findUnique({ where: { id } });

  return NextResponse.json(stockCount);
}
