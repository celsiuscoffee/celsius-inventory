import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { verifyPin, hashPin } from "@celsius/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfterMs } = await checkRateLimit(`pin:${ip}`, 10, 300_000);
  if (limited) {
    return NextResponse.json(
      { error: "Too many PIN attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const { pin, outletId } = await req.json();

  if (!pin || pin.length < 4) {
    return NextResponse.json({ error: "PIN required (minimum 4 digits)" }, { status: 400 });
  }

  // Find users with PINs — OWNER/ADMIN can log in to any outlet,
  // STAFF are scoped to their assigned outlet to prevent collisions
  const users = await prisma.user.findMany({
    where: { pin: { not: null }, status: "ACTIVE" },
    include: { outlet: { select: { name: true } } },
  });

  // Track PIN-matched users whose only failure is missing "ops" so we can
  // surface that explicitly rather than misdirect with "Invalid PIN".
  type StaffRow = (typeof users)[number];
  const matches: StaffRow[] = [];
  const pinMatchedNoOps: StaffRow[] = [];
  for (const u of users) {
    // Staff must belong to the selected outlet; owners/admins can access any
    // Managers may have multiple outlets via outletIds array
    if (outletId && u.role !== "OWNER" && u.role !== "ADMIN" && u.outletId !== outletId && !u.outletIds.includes(outletId)) continue;
    const { match, needsRehash } = await verifyPin(pin, u.pin);
    if (!match) continue;

    const roleBypass = u.role === "OWNER" || u.role === "ADMIN";
    const hasOps = u.appAccess.includes("ops");
    if (!roleBypass && !hasOps) {
      pinMatchedNoOps.push(u);
      continue;
    }

    if (needsRehash) {
      await prisma.user.update({
        where: { id: u.id },
        data: { pin: await hashPin(pin) },
      });
    }
    matches.push(u);
  }

  if (matches.length === 0) {
    if (pinMatchedNoOps.length > 0) {
      return NextResponse.json(
        { error: "PIN ok but no ops access — ask an admin to enable Outlet Operations for your account." },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (matches.length > 1) {
    const names = matches.map((u) => u.name).join(", ");
    console.warn(`[AUTH] Duplicate PIN detected for: ${names}`);
    return NextResponse.json(
      { error: `Duplicate PIN — contact manager (${names})` },
      { status: 409 },
    );
  }

  const matchedUser = matches[0];

  // Use the selected outlet for the session (allows owners to operate any outlet)
  const selectedOutlet = outletId
    ? await prisma.outlet.findUnique({ where: { id: outletId }, select: { name: true } })
    : matchedUser.outlet;

  await createSession({
    id: matchedUser.id,
    name: matchedUser.name,
    role: matchedUser.role,
    outletId: outletId || matchedUser.outletId,
    outletName: selectedOutlet?.name ?? matchedUser.outlet?.name ?? null,
  });

  return NextResponse.json({
    id: matchedUser.id,
    name: matchedUser.name,
    role: matchedUser.role,
    moduleAccess: matchedUser.moduleAccess ?? {},
  });
}
