// POST /api/loyalty/referral/attribute — called during signup when the
// new member entered a referral code on the welcome screen.
//
// Body: { code: string }  (member resolved from Bearer session)
//
// Records a pending attribution. Both-side rewards land when the new
// member completes their first paid order (hooked in confirm-stripe).

import { NextRequest, NextResponse } from "next/server";
import { resolveMember } from "@/lib/loyalty/v2-auth";
import { attributeReferralOnSignup } from "@/lib/loyalty/v2";

export async function POST(req: NextRequest) {
  const r = await resolveMember(req);
  if (r.error) return r.error as unknown as NextResponse;

  const body = await req.json().catch(() => null);
  const code = (body?.code as string | undefined)?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const result = await attributeReferralOnSignup({
    refereeId: r.member.memberId,
    code,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid or already-used referral code" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
