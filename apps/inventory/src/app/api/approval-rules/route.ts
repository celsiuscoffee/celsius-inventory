import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET() {
  const rules = await prisma.approvalRule.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Resolve branch names and approver names
  const branchIds = [...new Set(rules.flatMap((r) => r.branches))];
  const approverIds = [...new Set(rules.flatMap((r) => r.approverIds))];

  const [branches, approvers] = await Promise.all([
    branchIds.length > 0
      ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : [],
    approverIds.length > 0
      ? prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const approverMap = Object.fromEntries(approvers.map((a) => [a.id, a.name]));

  const mapped = rules.map((r) => ({
    id: r.id,
    name: r.name,
    ruleType: r.ruleType,
    condition: r.condition,
    threshold: r.threshold ? Number(r.threshold) : null,
    branches: r.branches.map((id) => ({ id, name: branchMap[id] || id })),
    approvers: r.approverIds.map((id) => ({ id, name: approverMap[id] || id })),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const caller = getUserFromHeaders(req.headers);
  if (!caller || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { name, ruleType, condition, threshold, branches, approverIds, isActive } = body;

  if (!name || !ruleType || !condition) {
    return NextResponse.json({ error: "name, ruleType, and condition are required" }, { status: 400 });
  }

  const rule = await prisma.approvalRule.create({
    data: {
      name,
      ruleType,
      condition,
      threshold: threshold ?? null,
      branches: branches || [],
      approverIds: approverIds || [],
      isActive: isActive !== false,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
