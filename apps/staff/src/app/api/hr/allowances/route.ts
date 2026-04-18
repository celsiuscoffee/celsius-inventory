import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { computeAllowances } from "@/lib/hr/allowances";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const breakdown = await computeAllowances(session.id, now.getFullYear(), now.getMonth() + 1);
  return NextResponse.json({ breakdown });
}
