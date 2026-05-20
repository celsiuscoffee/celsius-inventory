import { prisma } from "./prisma";

/**
 * Update stock balance for a product+package at an outlet.
 *
 * @param outletId - Outlet ID
 * @param productId - Product ID
 * @param delta - Positive to add stock, negative to subtract
 * @param productPackageId - Optional package ID (tracks stock per SKU)
 */
export async function adjustStockBalance(
  outletId: string,
  productId: string,
  delta: number,
  productPackageId?: string | null,
) {
  const pkgId = productPackageId ?? null;

  const existing = await prisma.stockBalance.findFirst({
    where: { outletId, productId, productPackageId: pkgId },
  });

  if (existing) {
    await prisma.stockBalance.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: delta },
        lastUpdated: new Date(),
      },
    });
  } else {
    await prisma.stockBalance.create({
      data: {
        outletId,
        productId,
        productPackageId: pkgId,
        quantity: Math.max(0, delta),
        lastUpdated: new Date(),
      },
    });
  }

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
 *
 * Uses a compound-unique upsert when productPackageId is set (single
 * round-trip). Falls back to findFirst+update/create when productPackageId
 * is null, because Postgres treats NULL as distinct in unique indexes —
 * upsert on a null compound key would create duplicates instead of updating.
 */
export async function setStockBalance(
  outletId: string,
  productId: string,
  quantity: number,
  productPackageId?: string | null,
) {
  const pkgId = productPackageId ?? null;
  const safeQty = Math.max(0, quantity);
  const now = new Date();

  if (pkgId !== null) {
    // Fast path — one round-trip via compound-unique upsert.
    await prisma.stockBalance.upsert({
      where: {
        outletId_productId_productPackageId: {
          outletId,
          productId,
          productPackageId: pkgId,
        },
      },
      create: { outletId, productId, productPackageId: pkgId, quantity: safeQty, lastUpdated: now },
      update: { quantity: safeQty, lastUpdated: now },
    });
    return;
  }

  // Slow path — null productPackageId can't use ON CONFLICT (NULL distinct).
  const existing = await prisma.stockBalance.findFirst({
    where: { outletId, productId, productPackageId: null },
  });
  if (existing) {
    await prisma.stockBalance.update({
      where: { id: existing.id },
      data: { quantity: safeQty, lastUpdated: now },
    });
  } else {
    await prisma.stockBalance.create({
      data: { outletId, productId, productPackageId: null, quantity: safeQty, lastUpdated: now },
    });
  }
}
