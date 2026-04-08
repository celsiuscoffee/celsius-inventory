import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/checklists/[id]
 * Get a single checklist with all items
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const checklist = await prisma.checklist.findUnique({
    where: { id },
    include: {
      sop: {
        select: { id: true, title: true, description: true, content: true, category: { select: { name: true } } },
      },
      outlet: { select: { id: true, code: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      items: {
        orderBy: { stepNumber: "asc" },
        include: { completedBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

  return NextResponse.json(checklist);
}
