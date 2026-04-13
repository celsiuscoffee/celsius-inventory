import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/reviews/feedback?outletId=xxx
export async function GET(request: NextRequest) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outletId = request.nextUrl.searchParams.get("outletId");
  if (!outletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  const feedbacks = await prisma.internalFeedback.findMany({
    where: { outletId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Stats breakdown
  const stats = { total: feedbacks.length, star5: 0, star4: 0, star3: 0, star2: 0, star1: 0 };
  for (const f of feedbacks) {
    if (f.rating === 5) stats.star5++;
    else if (f.rating === 4) stats.star4++;
    else if (f.rating === 3) stats.star3++;
    else if (f.rating === 2) stats.star2++;
    else if (f.rating === 1) stats.star1++;
  }

  return NextResponse.json({ feedbacks, stats });
}

// POST /api/reviews/feedback — public endpoint for QR submissions (no auth)
export async function POST(request: NextRequest) {
  const { outletId, rating, name, phone, feedback } = await request.json();

  if (!outletId || !rating) {
    return NextResponse.json({ error: "outletId and rating required" }, { status: 400 });
  }

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
  }

  const created = await prisma.internalFeedback.create({
    data: {
      outletId,
      rating,
      name: name || null,
      phone: phone || null,
      feedback: feedback || null,
      source: "qr",
    },
  });

  return NextResponse.json({ success: true, id: created.id });
}
