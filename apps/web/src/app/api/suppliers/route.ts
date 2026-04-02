import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      supplierProducts: {
        include: {
          product: true,
          productPackage: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const mapped = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.supplierCode,
    location: s.location ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    status: s.status,
    tags: [] as string[],
    leadTime: "2-3 days",
    products: s.supplierProducts.map((sp) => ({
      name: sp.product.name,
      sku: sp.product.sku,
      price: Number(sp.price),
      uom: sp.productPackage?.packageLabel ?? sp.productPackage?.packageName ?? sp.product.baseUom,
    })),
    scorecard: {
      onTime: 95,
      shortDelivery: 3,
      priceChange: 0,
      avgLeadTime: 2,
    },
  }));

  return NextResponse.json(mapped);
}
