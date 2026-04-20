import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";
import { resolveVisibleUserIds } from "@/lib/hr/scope";

export const dynamic = "force-dynamic";

// GET: list employees with their HR profiles
// - OWNER / ADMIN: all active users
// - MANAGER: only their direct reports (users whose hr_employee_profiles.manager_user_id = session.id)
// - other roles: unauthorized
export async function GET() {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all HR profiles from Supabase (need these for manager filter + enrichment)
  const { data: profiles } = await hrSupabaseAdmin
    .from("hr_employee_profiles")
    .select("*");
  const profileMap = new Map((profiles || []).map((p: { user_id: string }) => [p.user_id, p]));

  // Determine visible user-id set for non-admin managers.
  // Managers see EVERYONE in their subtree — direct reports AND reports-of-reports —
  // walked transitively via manager_user_id. Shared helper in lib/hr/scope.ts.
  const visibleIds = await resolveVisibleUserIds(session);

  // Payroll PII (bank, salary, statutory IDs) is restricted to OWNER/ADMIN only.
  // MANAGER sees minimal profile — personnel info, not compensation/banking.
  const canSeePayrollPII = ["OWNER", "ADMIN"].includes(session.role);

  // Include DEACTIVATED users too — the client can filter for the Resigned tab.
  // Keeps ACTIVE users first in the result (alphabetical within role).
  const users = await prisma.user.findMany({
    where: {
      status: { in: ["ACTIVE", "DEACTIVATED"] },
      ...(visibleIds !== null ? { id: { in: visibleIds } } : {}),
    },
    select: {
      id: true, name: true, fullName: true, role: true, phone: true, email: true,
      outletId: true, outlet: { select: { name: true } },
      username: true, appAccess: true, moduleAccess: true, status: true,
      pin: true, passwordHash: true, lastLoginAt: true,
      ...(canSeePayrollPII ? { bankName: true, bankAccountNumber: true, bankAccountName: true } : {}),
    },
    orderBy: [{ status: "asc" }, { role: "asc" }, { name: "asc" }],
  });

  const PII_PROFILE_FIELDS = [
    "basic_salary", "hourly_rate",
    "attendance_allowance_amount", "performance_allowance_amount",
    "ic_number", "passport_number", "passport_expiry",
    "epf_number", "socso_number", "eis_number", "tax_number", "pcb_number",
    "epf_employee_rate", "epf_employer_rate", "epf_category",
    "overtime_flat_rate",
  ];

  const sanitizeProfile = (profile: Record<string, unknown> | undefined) => {
    if (!profile) return null;
    if (canSeePayrollPII) return profile;
    const copy = { ...profile };
    for (const k of PII_PROFILE_FIELDS) delete copy[k];
    return copy;
  };

  const employees = users.map((u) => {
    const { pin, passwordHash, ...rest } = u;
    return {
      ...rest,
      hasPin: !!pin,
      hasPassword: !!passwordHash,
      hrProfile: sanitizeProfile(profileMap.get(u.id) as Record<string, unknown> | undefined),
    };
  });

  return NextResponse.json({ employees, scope: session.role === "MANAGER" ? "direct-reports" : "all" });
}

// POST: create or update an HR profile for an employee
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { user_id, ...profileData } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  // Upsert: check if profile exists
  const { data: existing } = await hrSupabaseAdmin
    .from("hr_employee_profiles")
    .select("id")
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .update({ ...profileData, updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  } else {
    const { data, error } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .insert({ user_id, ...profileData })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  }
}
