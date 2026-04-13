import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replyToReview } from "@/lib/reviews/gbp";

// POST /api/reviews/reply
export async function POST(request: NextRequest) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outletId, reviewId, comment } = await request.json();
  if (!outletId || !reviewId || !comment) {
    return NextResponse.json({ error: "outletId, reviewId, comment required" }, { status: 400 });
  }

  const settings = await prisma.reviewSettings.findUnique({ where: { outletId } });
  if (!settings?.gbpAccountId || !settings?.gbpLocationName) {
    return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
  }

  try {
    await replyToReview(settings.gbpAccountId, settings.gbpLocationName, reviewId, comment);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("GBP reply error:", err);
    return NextResponse.json({ error: "Failed to reply" }, { status: 502 });
  }
}
