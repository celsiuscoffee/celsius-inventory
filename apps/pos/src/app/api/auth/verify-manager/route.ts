import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPin } from "@celsius/auth";

/**
 * Verify a manager/admin PIN for override actions (e.g. discounts).
 * Does NOT create a session — just validates the PIN belongs to a manager+.
 */
export async function POST(req: NextRequest) {
  const { pin } = await req.json();

  if (!pin || pin.length < 4) {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  const candidates = await prisma.user.findMany({
    where: {
      pin: { not: null },
      role: { in: ["MANAGER", "ADMIN", "OWNER"] },
      status: "ACTIVE",
    },
    select: { id: true, pin: true, name: true },
  });

  for (const user of candidates) {
    const { match } = await verifyPin(pin, user.pin);
    if (match) {
      return NextResponse.json({ ok: true, name: user.name });
    }
  }

  return NextResponse.json({ error: "Invalid manager PIN" }, { status: 401 });
}
