import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    include: {
      branch: true,
    },
    orderBy: { name: "asc" },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    branch: u.branch?.name ?? "",
    branchCode: u.branch?.code ?? "",
    phone: u.phone ?? "",
    email: u.email,
    status: u.status,
    addedDate: u.createdAt.toISOString().split("T")[0],
  }));

  return NextResponse.json(mapped);
}
