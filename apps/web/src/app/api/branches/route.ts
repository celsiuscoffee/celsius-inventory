import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const branches = await prisma.branch.findMany({
    include: {
      _count: {
        select: { users: true, branchProducts: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const mapped = branches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    type: b.type,
    status: b.status,
    address: b.address ?? "",
    city: b.city ?? "",
    state: b.state ?? "",
    phone: b.phone ?? "",
    staffCount: b._count.users,
    productCount: b._count.branchProducts,
  }));

  return NextResponse.json(mapped);
}
