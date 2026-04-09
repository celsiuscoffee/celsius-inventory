import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/checklists/generate
 * Generate today's checklists from active SOP schedules.
 * Body: { outletId, date? }
 *
 * Supports recurrence types:
 * - SHIFT: one checklist per shift (legacy behavior)
 * - SPECIFIC_TIMES: one checklist per time in schedule.times[]
 * - HOURLY: one checklist per hour during operating hours
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const outletId = body.outletId as string;
  const date = body.date ? new Date(body.date) : new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = dateOnly.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  if (!outletId) {
    return NextResponse.json({ error: "outletId is required" }, { status: 400 });
  }

  // Get outlet operating hours for HOURLY recurrence
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { openTime: true, closeTime: true },
  });
  const openHour = parseInt(outlet?.openTime?.split(":")[0] || "8");
  const closeHour = parseInt(outlet?.closeTime?.split(":")[0] || "22");

  // Find all active schedules for this outlet and day
  const schedules = await prisma.sopSchedule.findMany({
    where: {
      outletId,
      isActive: true,
      daysOfWeek: { has: dayOfWeek },
      OR: [{ startDate: null }, { startDate: { lte: dateOnly } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: dateOnly } }] }],
      sop: { status: "PUBLISHED" },
    },
    include: {
      sop: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
    },
  });

  if (schedules.length === 0) {
    return NextResponse.json({ message: "No active schedules for this outlet/day", created: 0 });
  }

  let created = 0;

  for (const schedule of schedules) {
    // Determine time slots based on recurrence
    let timeSlots: string[];

    switch (schedule.recurrence) {
      case "SPECIFIC_TIMES":
        timeSlots = schedule.times.length > 0 ? schedule.times : [""]; // fallback
        break;
      case "HOURLY":
        timeSlots = [];
        for (let h = openHour; h < closeHour; h++) {
          timeSlots.push(`${h.toString().padStart(2, "0")}:00`);
        }
        break;
      case "SHIFT":
      default:
        timeSlots = [""]; // empty string = no time slot (shift-only)
        break;
    }

    for (const timeSlot of timeSlots) {
      // Calculate dueAt
      let dueAt: Date | null = null;
      if (timeSlot && schedule.dueMinutes > 0) {
        const [h, m] = timeSlot.split(":").map(Number);
        dueAt = new Date(dateOnly);
        dueAt.setHours(h, m + schedule.dueMinutes, 0, 0);
      } else if (timeSlot) {
        // Default: due at the time slot itself + 60 min
        const [h, m] = timeSlot.split(":").map(Number);
        dueAt = new Date(dateOnly);
        dueAt.setHours(h, m + 60, 0, 0);
      }

      const slotValue = timeSlot || null;

      // Check if already exists
      const existing = await prisma.checklist.findFirst({
        where: {
          sopId: schedule.sopId,
          outletId,
          date: dateOnly,
          shift: schedule.shift,
          assignedToId: schedule.assignedToId,
          timeSlot: slotValue,
        },
      });

      if (existing) continue;

      await prisma.checklist.create({
        data: {
          sopId: schedule.sopId,
          outletId,
          assignedToId: schedule.assignedToId,
          date: dateOnly,
          shift: schedule.shift,
          timeSlot: slotValue,
          dueAt,
          items: {
            create: schedule.sop.steps.map((step) => ({
              stepNumber: step.stepNumber,
              title: step.title,
              description: step.description,
              photoRequired: step.photoRequired,
            })),
          },
        },
      });
      created++;
    }
  }

  return NextResponse.json({ message: `Generated ${created} checklist(s)`, created });
}
