import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/checklists/generate
 * Generate today's checklists from active SOP schedules.
 * Body: { outletId, date?, shift? }
 *
 * Finds all active SopSchedules for the outlet/shift/day-of-week,
 * then creates a Checklist per schedule (SOP + staff assignment).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const outletId = body.outletId as string;
  const shift = (body.shift as string) || "OPENING";
  const date = body.date ? new Date(body.date) : new Date();

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // JS: 0=Sun, 1=Mon...6=Sat → convert to 1=Mon...7=Sun
  const jsDay = dateOnly.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  if (!outletId) {
    return NextResponse.json({ error: "outletId is required" }, { status: 400 });
  }

  // Find active schedules for this outlet, shift, and day
  const schedules = await prisma.sopSchedule.findMany({
    where: {
      outletId,
      shift: shift as "OPENING" | "MIDDAY" | "CLOSING",
      isActive: true,
      daysOfWeek: { has: dayOfWeek },
      OR: [
        { startDate: null },
        { startDate: { lte: dateOnly } },
      ],
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: dateOnly } }] },
      ],
      sop: { status: "PUBLISHED" },
    },
    include: {
      sop: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
    },
  });

  if (schedules.length === 0) {
    return NextResponse.json({ message: "No active schedules for this outlet/shift/day", created: 0 });
  }

  let created = 0;

  for (const schedule of schedules) {
    // Check if checklist already exists
    const existing = await prisma.checklist.findFirst({
      where: {
        sopId: schedule.sopId,
        outletId,
        date: dateOnly,
        shift: shift as "OPENING" | "MIDDAY" | "CLOSING",
        assignedToId: schedule.assignedToId,
      },
    });

    if (existing) continue;

    await prisma.checklist.create({
      data: {
        sopId: schedule.sopId,
        outletId,
        assignedToId: schedule.assignedToId,
        date: dateOnly,
        shift: shift as "OPENING" | "MIDDAY" | "CLOSING",
        items: {
          create: schedule.sop.steps.map((step) => ({
            stepNumber: step.stepNumber,
            title: step.title,
            description: step.description,
          })),
        },
      },
    });
    created++;
  }

  return NextResponse.json({ message: `Generated ${created} checklist(s)`, created });
}
