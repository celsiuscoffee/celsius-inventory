import { NextRequest, NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/customer-jwt";

// .trim() guards against accidental trailing newlines in env var values
const LOYALTY_BASE = (process.env.LOYALTY_BASE_URL ?? "https://loyalty.celsiuscoffee.com").trim();
const BRAND_ID     = (process.env.LOYALTY_BRAND_ID  ?? "brand-celsius").trim();

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+6${digits}`;
  return `+60${digits}`;
}

// GET /api/loyalty/member?phone=+60123456789 OR ?email=user@example.com — refresh member data
export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");
    const email = request.nextUrl.searchParams.get("email");
    if (!phone && !email) return NextResponse.json({ error: "Phone or email required" }, { status: 400 });

    const normPhone = phone ? normalisePhone(phone) : null;

    // STRICT mode (env-flag-gated): require a Bearer token whose
    // signed phone matches the queried phone. Off by default; flip
    // STRICT_CUSTOMER_AUTH=true once every active client sends the
    // token. Email-keyed lookups are NOT covered by this gate
    // because email isn't part of the JWT payload — keep them
    // server-internal-only after STRICT lands.
    const guard = requireCustomerSession(request);
    if (guard.error) return guard.error as unknown as NextResponse;
    if (guard.session && normPhone && guard.session.phone !== normPhone) {
      return NextResponse.json(
        { error: "Session does not match phone" },
        { status: 403 }
      );
    }
    const query = normPhone
      ? `phone=${encodeURIComponent(normPhone)}`
      : `email=${encodeURIComponent(email!)}`;

    const res = await fetch(
      `${LOYALTY_BASE}/api/members?brand_id=${BRAND_ID}&${query}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const members = await res.json();
    const member = Array.isArray(members) && members.length > 0 ? members[0] : null;

    if (!member) return NextResponse.json({ member: null });

    const brandData = member.brand_data ?? {};

    return NextResponse.json({
      member: {
        id:                member.id,
        phone:             member.phone,
        name:              member.name ?? null,
        pointsBalance:     brandData.points_balance      ?? 0,
        totalPointsEarned: brandData.total_points_earned ?? 0,
        totalVisits:       brandData.total_visits         ?? 0,
      },
    });
  } catch (err) {
    console.error("Loyalty member fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch member" }, { status: 500 });
  }
}
