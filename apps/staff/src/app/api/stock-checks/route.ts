import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { setStockBalance } from "@/lib/stock";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const outletId = url.searchParams.get("outletId") || session.outletId;
  const where = outletId ? { outletId } : {};

  const stockCounts = await prisma.stockCount.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  });

  const mapped = stockCounts.map((sc) => ({
    id: sc.id,
    outlet: sc.outlet.name,
    outletCode: sc.outlet.code,
    frequency: sc.frequency,
    countedBy: sc.countedBy.name,
    countDate: sc.countDate.toISOString(),
    status: sc.status,
    notes: sc.notes,
    submittedAt: sc.submittedAt?.toISOString() ?? null,
    reviewedAt: sc.reviewedAt?.toISOString() ?? null,
    createdAt: sc.createdAt.toISOString(),
    items: sc.items.map((i) => ({
      id: i.id,
      product: i.product.name,
      sku: i.product.sku,
      package: i.productPackage?.packageLabel ?? i.productPackage?.packageName ?? "",
      expectedQty: i.expectedQty ? Number(i.expectedQty) : null,
      countedQty: i.countedQty ? Number(i.countedQty) : null,
      isConfirmed: i.isConfirmed,
      varianceReason: i.varianceReason,
    })),
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { outletId, frequency, notes, items } = body;

  // Server-set: never trust client-supplied countedById, and require the
  // outlet matches the user's session unless they are OWNER/ADMIN.
  const isAdmin = session.role === "OWNER" || session.role === "ADMIN";
  if (!isAdmin && outletId !== session.outletId) {
    return NextResponse.json({ error: "Cannot submit stock count for another outlet" }, { status: 403 });
  }

  const stockCount = await prisma.stockCount.create({
    data: {
      outletId,
      countedById: session.id,
      frequency,
      status: "SUBMITTED",
      submittedAt: new Date(),
      notes: notes || null,
      items: {
        create: items.map((i: { productId: string; productPackageId?: string; expectedQty?: number; countedQty?: number; isConfirmed?: boolean; varianceReason?: string }) => ({
          productId: i.productId,
          productPackageId: i.productPackageId || null,
          expectedQty: i.expectedQty ?? null,
          countedQty: i.countedQty ?? null,
          isConfirmed: i.isConfirmed ?? false,
          varianceReason: i.varianceReason || null,
        })),
      },
    },
    include: {
      outlet: true,
      countedBy: true,
      items: { include: { product: true, productPackage: true } },
    },
  });

  // Update stock balances from counted quantities (parallel)
  await Promise.all(
    items
      .filter((item: { countedQty?: number }) => item.countedQty !== null && item.countedQty !== undefined)
      .map((item: { productId: string; countedQty: number }) =>
        setStockBalance(outletId, item.productId, item.countedQty),
      ),
  );

  return NextResponse.json(stockCount, { status: 201 });
}
