import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Include branch name if user has a branch
  let branchName: string | null = null;
  if (session.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: session.branchId },
      select: { name: true },
    });
    branchName = branch?.name ?? null;
  }

  return NextResponse.json({ ...session, branchName });
}
