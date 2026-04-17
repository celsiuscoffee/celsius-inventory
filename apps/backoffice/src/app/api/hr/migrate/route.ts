import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(mr|ms|mrs|dr|bin|binti|bt|b\.|@)\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  const tokensA = new Set(na.split(" ").filter((t) => t.length > 1));
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 1));
  const shared = [...tokensA].filter((t) => tokensB.has(t)).length;
  const total = Math.max(tokensA.size, tokensB.size);
  return total === 0 ? 0 : shared / total;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Smart CSV parser — handles quoted fields with commas
  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuote = !inQuote;
      else if (c === "," && !inQuote) { cells.push(current); current = ""; }
      else current += c;
    }
    cells.push(current);
    return cells.map((c) => c.trim().replace(/^"|"$/g, ""));
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] || ""; });
    rows.push(row);
  }
  return rows;
}

/** Match a BrioHR name to an existing user ID */
async function resolveUserId(name: string, email: string | undefined, userMap: Map<string, { id: string; name: string; email: string | null }>): Promise<{ userId: string | null; score: number; matchName: string }> {
  let best = { userId: null as string | null, score: 0, matchName: "" };

  // Exact email match wins
  if (email) {
    for (const u of userMap.values()) {
      if (u.email?.toLowerCase() === email.toLowerCase()) {
        return { userId: u.id, score: 1.0, matchName: u.name };
      }
    }
  }

  // Fuzzy name
  for (const u of userMap.values()) {
    const score = similarity(u.name, name);
    if (score > best.score) best = { userId: u.id, score, matchName: u.name };
  }
  return best.score >= 0.6 ? best : { userId: null, score: best.score, matchName: "" };
}

// ─── Route ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, csv, dryRun } = body as { type: string; csv: string; dryRun: boolean };

  const rows = parseCSV(csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows parsed from CSV" }, { status: 400 });
  }

  // Load user map once (id, name, email)
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // ─── EMPLOYEES ─────────────────────────────────
  if (type === "employees") {
    const results: Array<{ briohr_id: string; name: string; user_id: string | null; score: number; match_name: string; status: string }> = [];
    let created = 0, updated = 0, unmatched = 0;

    for (const row of rows) {
      const briohr_id = row.employee_id || row.briohr_id || row.id || "";
      const name = row.employee_name || row.name || row.full_name || "";
      const email = row.email || row.email_address || "";
      if (!briohr_id || !name) continue;

      const match = await resolveUserId(name, email, userMap);
      results.push({
        briohr_id,
        name,
        user_id: match.userId,
        score: match.score,
        match_name: match.matchName,
        status: match.userId ? "matched" : "unmatched",
      });

      if (!match.userId) { unmatched++; continue; }

      if (dryRun) continue;

      const profileData = {
        briohr_id,
        briohr_imported_at: new Date().toISOString(),
        ic_number: row.ic_number || row.identity_card || row.nric || null,
        date_of_birth: row.date_of_birth || row.dob || null,
        gender: row.gender?.charAt(0).toUpperCase() || null,
        nationality: row.nationality || "Malaysian",
        join_date: row.join_date || row.date_joined || row.hired_date || new Date().toISOString().slice(0, 10),
        employment_type: (row.employment_type || row.type || "full_time").toLowerCase().replace(/\s+/g, "_").replace("parttime", "part_time").replace("fulltime", "full_time"),
        position: row.job_title || row.position || row.role || null,
        basic_salary: parseFloat((row.basic_salary || row.salary || "0").replace(/,/g, "")) || 0,
        hourly_rate: row.hourly_rate ? parseFloat(row.hourly_rate) : null,
        epf_number: row.epf_number || row.epf || null,
        socso_number: row.socso_number || row.socso || null,
        eis_number: row.eis_number || row.eis || null,
        tax_number: row.tax_number || row.income_tax_number || null,
        emergency_contact_name: row.emergency_contact_name || null,
        emergency_contact_phone: row.emergency_contact_phone || null,
      };

      const { data: existing } = await hrSupabaseAdmin
        .from("hr_employee_profiles")
        .select("id")
        .eq("user_id", match.userId)
        .maybeSingle();

      if (existing) {
        await hrSupabaseAdmin
          .from("hr_employee_profiles")
          .update({ ...profileData, updated_at: new Date().toISOString() })
          .eq("user_id", match.userId);
        updated++;
      } else {
        await hrSupabaseAdmin
          .from("hr_employee_profiles")
          .insert({ user_id: match.userId, ...profileData });
        created++;
      }
    }

    return NextResponse.json({
      type,
      total: rows.length,
      matched: rows.length - unmatched,
      unmatched,
      created,
      updated,
      dryRun,
      results,
    });
  }

  // ─── LEAVE BALANCES ─────────────────────────────
  if (type === "leave_balances") {
    // Expects: employee_id, employee_name, leave_type, entitled, used, balance, year
    // OR the BrioHR export format: Employee | Leave Type | Entitlement | Used | Balance
    const year = parseInt(body.year || String(new Date().getFullYear()));

    // Pre-load briohr_id → user_id map
    const { data: profiles } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .select("user_id, briohr_id");
    const brioIdMap = new Map((profiles || []).filter((p: { briohr_id: string | null }) => p.briohr_id).map((p: { briohr_id: string; user_id: string }) => [p.briohr_id, p.user_id]));

    let imported = 0, skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const brioId = row.employee_id || row.briohr_id || "";
      const name = row.employee_name || row.name || row.employee || "";
      const leaveType = (row.leave_type || row.type || "annual").toLowerCase().replace(/\s+/g, "_").replace("annual_leave", "annual");
      const entitled = parseFloat(row.entitlement || row.entitled || row.entitled_days || "0");
      const used = parseFloat(row.used || row.used_days || row.taken || "0");
      const carryForward = parseFloat(row.carried_forward || row.carry_forward || "0");

      if (entitled === 0 && used === 0) { skipped++; continue; }

      let userId = brioIdMap.get(brioId);
      if (!userId && name) {
        const match = await resolveUserId(name, undefined, userMap);
        userId = match.userId ?? undefined;
      }
      if (!userId) { errors.push(`No match: ${name || brioId}`); continue; }

      if (dryRun) { imported++; continue; }

      await hrSupabaseAdmin
        .from("hr_leave_balances")
        .upsert(
          {
            user_id: userId,
            year,
            leave_type: leaveType,
            entitled_days: entitled,
            used_days: used,
            carried_forward: carryForward,
            pending_days: 0,
          },
          { onConflict: "user_id,year,leave_type" },
        );
      imported++;
    }

    return NextResponse.json({ type, total: rows.length, imported, skipped, errors, dryRun });
  }

  // ─── LEAVE HISTORY ─────────────────────────────
  if (type === "leave_history") {
    const { data: profiles } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .select("user_id, briohr_id");
    const brioIdMap = new Map((profiles || []).filter((p: { briohr_id: string | null }) => p.briohr_id).map((p: { briohr_id: string; user_id: string }) => [p.briohr_id, p.user_id]));

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const brioId = row.employee_id || row.briohr_id || "";
      const name = row.employee_name || row.name || row.employee || "";
      const leaveType = (row.leave_type || row.type || "annual").toLowerCase().replace(/\s+/g, "_").replace("annual_leave", "annual");
      const startDate = row.start_date || row.from || row.from_date || "";
      const endDate = row.end_date || row.to || row.to_date || startDate;
      const totalDays = parseFloat(row.days || row.total_days || row.duration || "1");
      const reason = row.reason || row.remarks || null;
      const status = (row.status || "approved").toLowerCase();

      if (!startDate || totalDays === 0) continue;

      let userId = brioIdMap.get(brioId);
      if (!userId && name) {
        const match = await resolveUserId(name, undefined, userMap);
        userId = match.userId ?? undefined;
      }
      if (!userId) { errors.push(`No match: ${name || brioId}`); continue; }

      if (dryRun) { imported++; continue; }

      await hrSupabaseAdmin
        .from("hr_leave_requests")
        .insert({
          user_id: userId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason,
          status: status === "approved" ? "approved" : status === "rejected" ? "rejected" : "approved",
          ai_decision: "migrated_from_briohr",
          approved_at: status === "approved" ? startDate + "T00:00:00Z" : null,
        });
      imported++;
    }

    return NextResponse.json({ type, total: rows.length, imported, errors, dryRun });
  }

  // ─── ATTENDANCE LOGS ─────────────────────────────
  if (type === "attendance") {
    const { data: profiles } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .select("user_id, briohr_id");
    const brioIdMap = new Map((profiles || []).filter((p: { briohr_id: string | null }) => p.briohr_id).map((p: { briohr_id: string; user_id: string }) => [p.briohr_id, p.user_id]));

    // Load users with outletId for attendance outlet assignment
    const usersWithOutlet = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, outletId: true },
    });
    const userOutletMap = new Map(usersWithOutlet.map((u) => [u.id, u.outletId]));

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const brioId = row.employee_id || row.briohr_id || "";
      const name = row.employee_name || row.name || row.employee || "";
      const date = row.date || row.attendance_date || "";
      const clockIn = row.clock_in || row.first_in || row.time_in || "";
      const clockOut = row.clock_out || row.last_out || row.time_out || "";
      const totalHoursStr = row.total_hours || row.hours_worked || row.hours || "0";
      const otHoursStr = row.overtime_hours || row.ot || row.ot_hours || "0";

      if (!date || !clockIn) continue;

      let userId = brioIdMap.get(brioId);
      if (!userId && name) {
        const match = await resolveUserId(name, undefined, userMap);
        userId = match.userId ?? undefined;
      }
      if (!userId) { errors.push(`No match: ${name || brioId}`); continue; }

      const outletId = userOutletMap.get(userId);
      if (!outletId) { errors.push(`No outlet: ${name || brioId}`); continue; }

      // Parse clock times (format: "HH:MM" or "YYYY-MM-DD HH:MM:SS")
      const parseDateTime = (date: string, time: string): string | null => {
        if (!time) return null;
        if (time.includes("T") || time.includes("-")) return new Date(time).toISOString();
        const [h, m] = time.split(":").map((n) => parseInt(n));
        if (isNaN(h) || isNaN(m)) return null;
        return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`;
      };

      const clockInISO = parseDateTime(date, clockIn);
      const clockOutISO = parseDateTime(date, clockOut);
      if (!clockInISO) continue;

      const totalHours = parseFloat(totalHoursStr.replace(/h|hr/gi, "").trim()) || 0;
      const otHours = parseFloat(otHoursStr.replace(/h|hr/gi, "").trim()) || 0;
      const regularHours = Math.max(0, totalHours - otHours);

      if (dryRun) { imported++; continue; }

      await hrSupabaseAdmin
        .from("hr_attendance_logs")
        .insert({
          user_id: userId,
          outlet_id: outletId,
          clock_in: clockInISO,
          clock_out: clockOutISO,
          clock_in_method: "manual",
          clock_out_method: clockOutISO ? "manual" : null,
          ai_status: "approved",
          ai_flags: ["migrated_from_briohr"],
          ai_processed_at: new Date().toISOString(),
          final_status: "approved",
          total_hours: totalHours,
          regular_hours: regularHours,
          overtime_hours: otHours,
          overtime_type: otHours > 0 ? "ot_1_5x" : null,
        });
      imported++;
    }

    return NextResponse.json({ type, total: rows.length, imported, errors, dryRun });
  }

  // ─── PAYROLL HISTORY ─────────────────────────────
  if (type === "payroll") {
    const { data: profiles } = await hrSupabaseAdmin
      .from("hr_employee_profiles")
      .select("user_id, briohr_id");
    const brioIdMap = new Map((profiles || []).filter((p: { briohr_id: string | null }) => p.briohr_id).map((p: { briohr_id: string; user_id: string }) => [p.briohr_id, p.user_id]));

    const month = parseInt(body.month);
    const year = parseInt(body.year);
    if (!month || !year) {
      return NextResponse.json({ error: "month and year required for payroll" }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];
    let totalGross = 0, totalDeductions = 0, totalNet = 0, totalEmployerCost = 0;

    // Create or reuse payroll run
    let runId: string;
    const { data: existingRun } = await hrSupabaseAdmin
      .from("hr_payroll_runs")
      .select("id")
      .eq("period_month", month)
      .eq("period_year", year)
      .maybeSingle();

    if (existingRun) {
      runId = existingRun.id;
      if (!dryRun) {
        await hrSupabaseAdmin.from("hr_payroll_items").delete().eq("payroll_run_id", runId);
      }
    } else if (!dryRun) {
      const { data: newRun, error: runErr } = await hrSupabaseAdmin
        .from("hr_payroll_runs")
        .insert({
          period_month: month,
          period_year: year,
          status: "confirmed",
          ai_notes: "Migrated from BrioHR",
          confirmed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 });
      runId = newRun.id;
    } else {
      runId = "dry-run";
    }

    for (const row of rows) {
      const brioId = row.employee_id || row.briohr_id || "";
      const name = row.employee_name || row.name || row.employee || "";
      const basic = parseFloat((row.basic_salary || row.basic || "0").replace(/,/g, "")) || 0;
      const otAmount = parseFloat((row.overtime || row.ot_amount || "0").replace(/,/g, "")) || 0;
      const gross = parseFloat((row.gross_pay || row.total_gross || row.gross || "0").replace(/,/g, "")) || basic + otAmount;
      const epfEmp = parseFloat((row.epf_employee || row.epf || "0").replace(/,/g, "")) || 0;
      const epfEmer = parseFloat((row.epf_employer || "0").replace(/,/g, "")) || 0;
      const socsoEmp = parseFloat((row.socso_employee || row.socso || "0").replace(/,/g, "")) || 0;
      const socsoEmer = parseFloat((row.socso_employer || "0").replace(/,/g, "")) || 0;
      const eisEmp = parseFloat((row.eis_employee || row.eis || "0").replace(/,/g, "")) || 0;
      const eisEmer = parseFloat((row.eis_employer || "0").replace(/,/g, "")) || 0;
      const pcb = parseFloat((row.pcb || row.tax || row.pcb_tax || "0").replace(/,/g, "")) || 0;
      const netPay = parseFloat((row.net_pay || row.net || row.take_home || "0").replace(/,/g, "")) || (gross - epfEmp - socsoEmp - eisEmp - pcb);
      const totalDeduct = epfEmp + socsoEmp + eisEmp + pcb;

      let userId = brioIdMap.get(brioId);
      if (!userId && name) {
        const match = await resolveUserId(name, undefined, userMap);
        userId = match.userId ?? undefined;
      }
      if (!userId) { errors.push(`No match: ${name || brioId}`); continue; }

      if (dryRun) {
        imported++;
        totalGross += gross;
        totalDeductions += totalDeduct;
        totalNet += netPay;
        totalEmployerCost += epfEmer + socsoEmer + eisEmer;
        continue;
      }

      await hrSupabaseAdmin
        .from("hr_payroll_items")
        .insert({
          payroll_run_id: runId,
          user_id: userId,
          basic_salary: basic,
          ot_1_5x_amount: otAmount,
          total_gross: gross,
          epf_employee: epfEmp,
          epf_employer: epfEmer,
          socso_employee: socsoEmp,
          socso_employer: socsoEmer,
          eis_employee: eisEmp,
          eis_employer: eisEmer,
          pcb_tax: pcb,
          total_deductions: totalDeduct,
          net_pay: netPay,
          computation_details: { migrated_from_briohr: true },
        });
      imported++;
      totalGross += gross;
      totalDeductions += totalDeduct;
      totalNet += netPay;
      totalEmployerCost += epfEmer + socsoEmer + eisEmer;
    }

    // Update run totals
    if (!dryRun && runId !== "dry-run") {
      await hrSupabaseAdmin
        .from("hr_payroll_runs")
        .update({
          total_gross: Math.round(totalGross * 100) / 100,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          total_net: Math.round(totalNet * 100) / 100,
          total_employer_cost: Math.round(totalEmployerCost * 100) / 100,
        })
        .eq("id", runId);
    }

    return NextResponse.json({
      type,
      total: rows.length,
      imported,
      errors,
      totals: { gross: totalGross, deductions: totalDeductions, net: totalNet, employerCost: totalEmployerCost },
      dryRun,
    });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
