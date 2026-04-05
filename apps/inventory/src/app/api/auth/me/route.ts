import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { password: true, username: true },
    });

    return NextResponse.json({
      ...session,
      hasPassword: !!user?.password,
      username: user?.username ?? null,
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; meta?: unknown };
    console.error("auth/me error:", e.code, e.message, e.meta);
    return NextResponse.json(
      { error: "DB error", code: e.code, message: e.message, meta: e.meta },
      { status: 500 },
    );
  }
}
