import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/stats
 * Returns all dashboard counts in a single query batch.
 * Replaces 7 separate full-list API calls on the admin dashboard.
 */
export async function GET() {
  const [
    products,
    suppliers,
    categories,
    branches,
    staff,
    menus,
    invoices,
    pendingInvoiceAgg,
    overdueInvoiceAgg,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { status: "ACTIVE" } }),
    prisma.category.count(),
    prisma.branch.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.menu.count({ where: { isActive: true } }),
    prisma.invoice.count(),
    prisma.invoice.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "OVERDUE" },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    products,
    suppliers,
    categories,
    branches,
    staff,
    menus,
    invoices: {
      total: invoices,
      pendingAmount: Number(pendingInvoiceAgg._sum.amount ?? 0),
      overdueAmount: Number(overdueInvoiceAgg._sum.amount ?? 0),
    },
  });
}
