import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/hr/payroll/compare
// Body: { run_id, brio_rows: [{ name | ic_number, basic, ot, gross, epf, socso, eis, pcb, zakat, net }] }
// Returns a row-by-row diff matching BrioHR's payslip data to our computed run.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { run_id, brio_rows } = body as {
    run_id: string;
    brio_rows: Array<{
      name?: string;
      ic_number?: string;
      basic?: number;
      ot?: number;
      gross?: number;
      epf?: number;
      socso?: number;
      eis?: number;
      pcb?: number;
      zakat?: number;
      net?: number;
    }>;
  };
  if (!run_id || !Array.isArray(brio_rows)) {
    return NextResponse.json({ error: "run_id and brio_rows required" }, { status: 400 });
  }

  const { data: items } = await hrSupabaseAdmin
    .from("hr_payroll_items")
    .select("*")
    .eq("payroll_run_id", run_id);
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Run has no items" }, { status: 404 });
  }

  const userIds = items.map((i: { user_id: string }) => i.user_id);
  const [users, profiles] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, fullName: true } }),
    hrSupabaseAdmin.from("hr_employee_profiles").select("user_id, ic_number").in("user_id", userIds),
  ]);
  const byName = new Map<string, typeof items[0]>();
  const byIc = new Map<string, typeof items[0]>();
  const profMap = new Map((profiles.data || []).map((p: { user_id: string; ic_number: string | null }) => [p.user_id, p]));
  for (const it of items) {
    const u = users.find((x) => x.id === it.user_id);
    const p = profMap.get(it.user_id) as { ic_number?: string } | undefined;
    if (u?.fullName) byName.set(u.fullName.toLowerCase(), it);
    if (u?.name) byName.set(u.name.toLowerCase(), it);
    if (p?.ic_number) byIc.set(p.ic_number.replace(/\D/g, ""), it);
  }

  const fmt = (n: number) => Math.round(n * 100) / 100;
  const diff = (ours: number, theirs: number) => fmt(ours - theirs);

  const results = brio_rows.map((b) => {
    const icClean = b.ic_number ? b.ic_number.replace(/\D/g, "") : null;
    const match =
      (icClean && byIc.get(icClean)) ||
      (b.name && byName.get(b.name.toLowerCase())) ||
      null;

    if (!match) {
      return { name: b.name || b.ic_number, matched: false, note: "No matching employee in our run" };
    }

    const checks = [
      { field: "basic", ours: Number(match.basic_salary), theirs: b.basic },
      { field: "ot_total", ours: Number(match.ot_1x_amount) + Number(match.ot_1_5x_amount) + Number(match.ot_2x_amount) + Number(match.ot_3x_amount), theirs: b.ot },
      { field: "gross", ours: Number(match.total_gross), theirs: b.gross },
      { field: "epf_employee", ours: Number(match.epf_employee), theirs: b.epf },
      { field: "socso_employee", ours: Number(match.socso_employee), theirs: b.socso },
      { field: "eis_employee", ours: Number(match.eis_employee), theirs: b.eis },
      { field: "pcb", ours: Number(match.pcb_tax), theirs: b.pcb },
      { field: "zakat", ours: Number((match.other_deductions as Record<string, unknown>)?.zakat || 0), theirs: b.zakat },
      { field: "net_pay", ours: Number(match.net_pay), theirs: b.net },
    ];

    const comparisons = checks.map((c) => {
      if (c.theirs === undefined || c.theirs === null) return { ...c, diff: null, status: "skipped" as const };
      const d = diff(c.ours, c.theirs);
      const pct = c.theirs !== 0 ? Math.abs(d / c.theirs) : Math.abs(d);
      const status = Math.abs(d) < 0.01 ? "match" : pct < 0.01 ? "near" : "mismatch";
      return { ...c, diff: d, status };
    });

    const mismatches = comparisons.filter((c) => c.status === "mismatch").length;

    return {
      name: b.name || b.ic_number,
      matched: true,
      mismatches,
      comparisons,
    };
  });

  const summary = {
    rows_compared: results.length,
    matched: results.filter((r) => r.matched).length,
    with_mismatches: results.filter((r) => r.matched && (r.mismatches ?? 0) > 0).length,
  };

  return NextResponse.json({ summary, results });
}
