import { prisma } from "./prisma";

/**
 * Update stock balance for a product+package at an outlet.
 * Uses upsert to create if not exists.
 *
 * @param outletId - Outlet ID
 * @param productId - Product ID
 * @param delta - Positive to add stock, negative to subtract (in base/package units)
 * @param productPackageId - Optional package ID (tracks stock per SKU)
 */
export async function adjustStockBalance(
  outletId: string,
  productId: string,
  delta: number,
  productPackageId?: string | null,
) {
  const pkgId = productPackageId || null;

  await prisma.stockBalance.upsert({
    where: {
      outletId_productId_productPackageId: { outletId, productId, productPackageId: pkgId },
    },
    create: {
      outletId,
      productId,
      productPackageId: pkgId,
      quantity: Math.max(0, delta),
      lastUpdated: new Date(),
    },
    update: {
      quantity: { increment: delta },
      lastUpdated: new Date(),
    },
  });

  // Clamp to zero (stock can't go negative)
  await prisma.stockBalance.updateMany({
    where: {
      outletId,
      productId,
      productPackageId: pkgId,
      quantity: { lt: 0 },
    },
    data: { quantity: 0 },
  });
}

/**
 * Set stock balance to an absolute value (used by stock counts).
 */
export async function setStockBalance(
  outletId: string,
  productId: string,
  quantity: number,
  productPackageId?: string | null,
) {
  const pkgId = productPackageId || null;

  await prisma.stockBalance.upsert({
    where: {
      outletId_productId_productPackageId: { outletId, productId, productPackageId: pkgId },
    },
    create: {
      outletId,
      productId,
      productPackageId: pkgId,
      quantity: Math.max(0, quantity),
      lastUpdated: new Date(),
    },
    update: {
      quantity: Math.max(0, quantity),
      lastUpdated: new Date(),
    },
  });
}
