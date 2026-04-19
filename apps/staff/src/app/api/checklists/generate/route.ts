import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/checklists/generate
 * Auto-generate today's checklists for an outlet.
 *
 * Two sources:
 * 1. SOP + SopOutlet (auto) — creates unassigned checklists anyone can claim
 * 2. SopSchedule (manual) — creates assigned checklists for specific staff
 *
 * Body: { outletId, date? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const outletId = body.outletId as string;

  // Date string is the MYT local date (e.g. "2026-04-11").
  // Parse directly as UTC date components — do NOT convert via timezone offset
  // because that shifts the UTC date back by one day.
  const dateStr = body.date || (() => {
    const myt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return myt.toISOString().split("T")[0];
  })();
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dateOnly = new Date(Date.UTC(y, mo - 1, d));
  const jsDay = dateOnly.getUTCDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;

  if (!outletId) {
    return NextResponse.json({ error: "outletId is required" }, { status: 400 });
  }

  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
    select: { openTime: true, closeTime: true },
  });
  const openHour = parseInt(outlet?.openTime?.split(":")[0] || "8");
  const closeHour = parseInt(outlet?.closeTime?.split(":")[0] || "22");

  let created = 0;

  // Pre-fetch once to avoid N+1 queries inside the generation loops.
  const [publishedSops, scheduledSopIds, existingForDay] = await Promise.all([
    prisma.sop.findMany({
      where: { status: "PUBLISHED", sopOutlets: { some: { outletId } } },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    }),
    prisma.sopSchedule.findMany({
      where: { outletId, isActive: true },
      select: { sopId: true },
      distinct: ["sopId"],
    }),
    prisma.checklist.findMany({
      where: { outletId, date: dateOnly },
      select: { sopId: true, timeSlot: true, assignedToId: true, shift: true },
    }),
  ]);

  const scheduledSopIdSet = new Set(scheduledSopIds.map((s) => s.sopId));
  // Composite key: sopId|timeSlot|assignedToId|shift. Null-safe with "∅" sentinel.
  const existingKey = (c: { sopId: string; timeSlot: string | null; assignedToId: string | null; shift: string }) =>
    `${c.sopId}|${c.timeSlot ?? "∅"}|${c.assignedToId ?? "∅"}|${c.shift}`;
  const existingSet = new Set(existingForDay.map(existingKey));

  // ─── Source 1: Auto-generate from SOP + SopOutlet (unassigned) ───
  for (const sop of publishedSops) {
    if (sop.expectedDaysOfWeek?.length && !sop.expectedDaysOfWeek.includes(dayOfWeek)) continue;
    if (scheduledSopIdSet.has(sop.id)) continue; // Handled by Source 2

    const timeSlots = getTimeSlots(sop.expectedRecurrence, sop.expectedTimes, sop.expectedTimesPerDay, openHour, closeHour);

    for (const timeSlot of timeSlots) {
      const slotValue = timeSlot || null;
      const shift = getShiftFromTime(timeSlot);
      const key = existingKey({ sopId: sop.id, timeSlot: slotValue, assignedToId: null, shift });
      if (existingSet.has(key)) continue;

      await prisma.checklist.create({
        data: {
          sopId: sop.id, outletId, assignedToId: null,
          date: dateOnly, shift, timeSlot: slotValue,
          dueAt: calcDueAt(dateOnly, timeSlot, sop.expectedDueMinutes),
          items: {
            create: sop.steps.map((step) => ({
              stepNumber: step.stepNumber, title: step.title,
              description: step.description, photoRequired: step.photoRequired,
            })),
          },
        },
      });
      existingSet.add(key);
      created++;
    }
  }

  // ─── Source 2: Generate from SopSchedule (assigned to specific staff) ───
  const schedules = await prisma.sopSchedule.findMany({
    where: {
      outletId, isActive: true, daysOfWeek: { has: dayOfWeek },
      OR: [{ startDate: null }, { startDate: { lte: dateOnly } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: dateOnly } }] }],
      sop: { status: "PUBLISHED" },
    },
    include: {
      sop: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
    },
  });

  for (const schedule of schedules) {
    const timeSlots = getTimeSlots(
      schedule.recurrence, schedule.times, schedule.times.length || 1, openHour, closeHour,
    );

    for (const timeSlot of timeSlots) {
      const slotValue = timeSlot || null;
      const key = existingKey({
        sopId: schedule.sopId, timeSlot: slotValue,
        assignedToId: schedule.assignedToId, shift: schedule.shift,
      });
      if (existingSet.has(key)) continue;

      await prisma.checklist.create({
        data: {
          sopId: schedule.sopId, outletId,
          assignedToId: schedule.assignedToId,
          date: dateOnly, shift: schedule.shift,
          timeSlot: slotValue,
          dueAt: calcDueAt(dateOnly, timeSlot, schedule.dueMinutes),
          items: {
            create: schedule.sop.steps.map((step) => ({
              stepNumber: step.stepNumber, title: step.title,
              description: step.description, photoRequired: step.photoRequired,
            })),
          },
        },
      });
      existingSet.add(key);
      created++;
    }
  }

  return NextResponse.json({ message: `Generated ${created} checklist(s)`, created });
}

// ─── Helpers ───

function getTimeSlots(
  recurrence: string, times: string[], count: number,
  openHour: number, closeHour: number,
): string[] {
  switch (recurrence) {
    case "SPECIFIC_TIMES":
      return times.length > 0 ? times : [""];
    case "HOURLY":
      return Array.from({ length: closeHour - openHour }, (_, i) =>
        `${(openHour + i).toString().padStart(2, "0")}:00`
      );
    case "SHIFT":
    default:
      return [""]; // no time slot
  }
}

function calcDueAt(dateOnly: Date, timeSlot: string, dueMinutes: number): Date | null {
  if (!timeSlot) return null;
  const [h, m] = timeSlot.split(":").map(Number);
  // SOP times are in Malaysia Time (UTC+8). Convert to UTC for storage.
  const totalMytMinutes = h * 60 + m + (dueMinutes || 60);
  const utcMinutes = totalMytMinutes - 480; // MYT is UTC+8 = 480 min
  const due = new Date(dateOnly);
  due.setUTCHours(0, 0, 0, 0);
  due.setTime(due.getTime() + utcMinutes * 60000);
  return due;
}

function getShiftFromTime(timeSlot: string): "OPENING" | "MIDDAY" | "CLOSING" {
  if (!timeSlot) return "OPENING";
  const hour = parseInt(timeSlot.split(":")[0]);
  if (hour < 12) return "OPENING";
  if (hour < 17) return "MIDDAY";
  return "CLOSING";
}
