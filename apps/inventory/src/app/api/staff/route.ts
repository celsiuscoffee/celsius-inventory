import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireRole, AuthError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const caller = getUserFromHeaders(req.headers);

  // Branch managers can only see users in their branch
  const where = caller?.role === "BRANCH_MANAGER" && caller.branchId
    ? { branchId: caller.branchId }
    : {};

  const users = await prisma.user.findMany({
    where,
    include: { branch: true },
    orderBy: { name: "asc" },
  });

  const mapped = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    branch: u.branch?.name ?? "",
    branchId: u.branchId,
    branchCode: u.branch?.code ?? "",
    phone: u.phone ?? "",
    email: u.email,
    status: u.status,
    addedDate: u.createdAt.toISOString().split("T")[0],
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  try {
    requireRole(req.headers, "ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();
  const { name, phone, email, role, branchId } = body;

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      email: email || null,
      role: role || "STAFF",
      branchId: branchId || null,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
