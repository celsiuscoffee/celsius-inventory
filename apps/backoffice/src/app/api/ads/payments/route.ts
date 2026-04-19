import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { randomUUID, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// GET — list payments for a year (optionally filtered by outlet/campaign)
export async function GET(req: NextRequest) {
  try {
    await requireRole(req.headers, "ADMIN");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const year = url.searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (year) where.yearMonth = { startsWith: `${year}-` };

  const payments = await prisma.adsPayment.findMany({
    where,
    orderBy: [{ yearMonth: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      yearMonth: p.yearMonth,
      outletId: p.outletId,
      campaignId: p.campaignId,
      subtotalMYR: Number(p.subtotalMicros) / 1_000_000,
      taxMYR: Number(p.taxMicros) / 1_000_000,
      totalMYR: Number(p.totalMicros) / 1_000_000,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      popPhotos: p.popPhotos,
      popTelegramToken: p.popTelegramToken,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// POST — create an initiated payment for a month
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireRole(req.headers, "ADMIN");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    yearMonth: string;
    outletId?: string | null;
    campaignId?: string | null;
    subtotalMYR: number;
    taxMYR: number;
    totalMYR: number;
  };

  if (!body.yearMonth || typeof body.totalMYR !== "number") {
    return NextResponse.json({ error: "yearMonth and totalMYR required" }, { status: 400 });
  }

  const popTelegramToken = randomBytes(12).toString("base64url");

  const payment = await prisma.adsPayment.create({
    data: {
      id: randomUUID(),
      yearMonth: body.yearMonth,
      outletId: body.outletId ?? null,
      campaignId: body.campaignId ?? null,
      subtotalMicros: BigInt(Math.round(body.subtotalMYR * 1_000_000)),
      taxMicros: BigInt(Math.round(body.taxMYR * 1_000_000)),
      totalMicros: BigInt(Math.round(body.totalMYR * 1_000_000)),
      status: "INITIATED",
      paidByUserId: user.id,
      popTelegramToken,
    },
  });

  return NextResponse.json({ id: payment.id, popTelegramToken });
}
