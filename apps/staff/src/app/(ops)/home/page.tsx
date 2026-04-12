import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

function getToday() {
  // Malaysia time (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return {
    dateStr: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`,
    dateObj: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  };
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { dateObj } = getToday();
  const outletId = session.outletId ?? undefined;
  const outletFilter = outletId ? { outletId } : undefined;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch checklists + dashboard data in ONE parallel query — no client waterfall
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const [checklists, todayCheck, lastCheck, sentOrders] = await Promise.all([
    db.checklist.findMany({
      where: {
        ...(outletId ? { outletId } : { assignedToId: session.id }),
        date: dateObj,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, date: true, shift: true, timeSlot: true, dueAt: true,
        status: true, completedAt: true,
        sop: { select: { id: true, title: true, category: { select: { name: true } } } },
        _count: { select: { items: true } },
        items: { where: { isCompleted: true }, select: { id: true } },
      },
    }),
    outletId
      ? db.stockCount.findFirst({
          where: { createdAt: { gte: todayStart }, ...outletFilter },
          select: { id: true },
        })
      : null,
    outletId
      ? db.stockCount.findFirst({
          where: outletFilter,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : null,
    outletId
      ? db.order.findMany({
          where: { status: { in: ["SENT", "APPROVED", "AWAITING_DELIVERY"] }, ...outletFilter },
          select: { supplier: { select: { name: true } } },
        })
      : [],
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checklistData = (checklists as any[]).map(({ items, ...cl }: any) => {
    const totalItems = cl._count.items;
    const completedItems = items.length;
    return {
      id: cl.id,
      status: cl.status as "PENDING" | "IN_PROGRESS" | "COMPLETED",
      sop: cl.sop,
      timeSlot: cl.timeSlot,
      dueAt: cl.dueAt?.toISOString() ?? null,
      totalItems,
      completedItems,
      progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  });

  const dashboardData = outletId
    ? {
        stockCheckDone: !!todayCheck,
        lastCheckTime: lastCheck?.createdAt?.toISOString() ?? null,
        deliveriesExpected: sentOrders.length,
        deliverySuppliers: (sentOrders as any[]).map((o: any) => o.supplier.name),
      }
    : null;

  return (
    <HomeClient
      user={{
        id: session.id,
        name: session.name,
        role: session.role,
        outletId: session.outletId ?? null,
        outletName: session.outletName ?? null,
      }}
      initialChecklists={checklistData}
      initialDashboard={dashboardData}
    />
  );
}
