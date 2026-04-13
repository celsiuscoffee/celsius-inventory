import { NextRequest, NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchGoogleReviews } from "@/lib/reviews/gbp";

// GET /api/reviews?outletId=xxx&pageToken=yyy
export async function GET(request: NextRequest) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const outletId = request.nextUrl.searchParams.get("outletId");
  if (!outletId) return NextResponse.json({ error: "outletId required" }, { status: 400 });

  const settings = await prisma.reviewSettings.findUnique({ where: { outletId } });
  if (!settings?.gbpAccountId || !settings?.gbpLocationName) {
    return NextResponse.json({
      reviews: [],
      averageRating: 0,
      totalReviewCount: 0,
      connected: false,
    });
  }

  try {
    const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined;
    const data = await fetchGoogleReviews(
      settings.gbpAccountId,
      settings.gbpLocationName,
      50,
      pageToken,
    );

    return NextResponse.json({ ...data, connected: true });
  } catch (err) {
    console.error("GBP fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Google reviews", reviews: [], connected: true },
      { status: 502 },
    );
  }
}
