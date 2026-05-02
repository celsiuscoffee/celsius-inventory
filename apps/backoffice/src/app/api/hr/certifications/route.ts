import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/hr/certifications?filter=all|expiring|expired&type=food_handler
//   filter (default = expiring):
//     - 'all'      → every cert across staff
//     - 'expiring' → expires within 60 days (urgent action zone)
//     - 'expired'  → already past expiry
//
// Used by /hr/certifications admin page to show the company-wide compliance
// dashboard. Inspectors love seeing this.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const filter = sp.get("filter") || "expiring";
  const type = sp.get("type");

  let q = hrSupabaseAdmin.from("hr_certifications").select("*");
  if (type) q = q.eq("cert_type", type);

  const today = new Date().toISOString().slice(0, 10);
  if (filter === "expired") {
    q = q.lt("expires_at", today);
  } else if (filter === "expiring") {
    const in60d = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    q = q.gte("expires_at", today).lte("expires_at", in60d);
  }

  const { data, error } = await q.order("expires_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hydrate with staff names so the table renders without a second round trip.
  const userIds = Array.from(new Set((data || []).map((c: { user_id: string }) => c.user_id)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, fullName: true, outlet: { select: { name: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Coverage rollup — per cert_type, how many active staff hold a non-expired
  // cert. Helps HR see "we have 38/42 staff with valid food handler" at a
  // glance.
  const { count: activeCount } = await hrSupabaseAdmin
    .from("hr_employee_profiles")
    .select("*", { count: "exact", head: true });

  const { data: validCerts } = await hrSupabaseAdmin
    .from("hr_certifications")
    .select("user_id, cert_type, expires_at")
    .or(`expires_at.gte.${today},expires_at.is.null`);

  const coverageMap = new Map<string, Set<string>>();
  for (const c of (validCerts || []) as Array<{ user_id: string; cert_type: string }>) {
    if (!coverageMap.has(c.cert_type)) coverageMap.set(c.cert_type, new Set());
    coverageMap.get(c.cert_type)!.add(c.user_id);
  }
  const coverage = Array.from(coverageMap.entries()).map(([cert_type, set]) => ({
    cert_type, valid_holders: set.size, total_staff: activeCount || 0,
  }));

  const today2 = new Date(); today2.setUTCHours(0, 0, 0, 0);
  const enriched = (data || []).map((c: { user_id: string; expires_at: string | null; [k: string]: unknown }) => {
    const u = userMap.get(c.user_id);
    let days_to_expiry: number | null = null;
    if (c.expires_at) {
      const exp = new Date(c.expires_at + "T00:00:00Z");
      days_to_expiry = Math.round((exp.getTime() - today2.getTime()) / 86_400_000);
    }
    return {
      ...c,
      user_name: u?.fullName || u?.name || null,
      outlet_name: u?.outlet?.name || null,
      days_to_expiry,
    };
  });

  return NextResponse.json({ certifications: enriched, coverage });
}
