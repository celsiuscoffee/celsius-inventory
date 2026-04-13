import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/reviews/settings?outletId=xxx
export async function GET(request: NextRequest) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outletId = request.nextUrl.searchParams.get("outletId");
  if (!outletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  let settings = await prisma.reviewSettings.findUnique({ where: { outletId } });

  // Auto-create default settings if none exist
  if (!settings) {
    settings = await prisma.reviewSettings.create({
      data: {
        outletId,
        ratingThreshold: 4,
        feedbackFields: [
          { question: "Name", type: "short_text", required: true, active: true },
          { question: "Phone", type: "phone", required: true, active: true },
          { question: "Feedback", type: "paragraph", required: false, active: true },
        ],
      },
    });
  }

  return NextResponse.json(settings);
}

// PUT /api/reviews/settings
export async function PUT(request: NextRequest) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { outletId, ...data } = body;

  if (!outletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  const settings = await prisma.reviewSettings.upsert({
    where: { outletId },
    update: { ...data, updatedAt: new Date() },
    create: { outletId, ...data },
  });

  return NextResponse.json(settings);
}
