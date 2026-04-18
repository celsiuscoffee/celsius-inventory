// Shared allowance computation — used by both backoffice and staff APIs.
import { hrSupabaseAdmin } from "./supabase";
import { prisma } from "@/lib/prisma";
import { fetchGoogleReviews } from "@/lib/reviews/gbp";

export type AllowanceRules = {
  attendance_allowance_amount: number;
  attendance_penalty_late: number;
  attendance_penalty_absent: number;
  attendance_penalty_early_out: number;
  attendance_penalty_missed_clockout: number;
  attendance_penalty_exceeded_break: number;
  attendance_late_threshold_minutes: number;
  attendance_early_out_threshold_minutes: number;
  attendance_break_overage_threshold_minutes: number;
  performance_allowance_amount: number;
  performance_allowance_mode: "tiered" | "linear";
  performance_tier_full_threshold: number;
  performance_tier_half_threshold: number;
  performance_tier_quarter_threshold: number;
};

export type AllowanceBreakdown = {
  userId: string;
  period: { year: number; month: number; daysElapsed: number; daysRemaining: number };
  attendance: {
    base: number;
    earned: number;
    penalties: { kind: string; label: string; amount: number; date?: string }[];
    metrics: { lateCount: number; absentCount: number; earlyOutCount: number; missedClockoutCount: number; exceededBreakCount: number };
    tip: string;
  };
  performance: {
    base: number;
    earned: number;
    score: number;
    mode: "tiered" | "linear";
    tip: string;
  };
  totalEarned: number;
  totalMax: number;
};

export async function loadAllowanceRules(): Promise<AllowanceRules> {
  const { data } = await hrSupabaseAdmin
    .from("hr_company_settings")
    .select("attendance_allowance_amount, attendance_penalty_late, attendance_penalty_absent, attendance_penalty_early_out, attendance_penalty_missed_clockout, attendance_penalty_exceeded_break, attendance_late_threshold_minutes, attendance_early_out_threshold_minutes, attendance_break_overage_threshold_minutes, performance_allowance_amount, performance_allowance_mode, performance_tier_full_threshold, performance_tier_half_threshold, performance_tier_quarter_threshold")
    .limit(1)
    .maybeSingle();
  return {
    attendance_allowance_amount: Number(data?.attendance_allowance_amount ?? 100),
    attendance_penalty_late: Number(data?.attendance_penalty_late ?? 5),
    attendance_penalty_absent: Number(data?.attendance_penalty_absent ?? 20),
    attendance_penalty_early_out: Number(data?.attendance_penalty_early_out ?? 10),
    attendance_penalty_missed_clockout: Number(data?.attendance_penalty_missed_clockout ?? 5),
    attendance_penalty_exceeded_break: Number(data?.attendance_penalty_exceeded_break ?? 3),
    attendance_late_threshold_minutes: Number(data?.attendance_late_threshold_minutes ?? 5),
    attendance_early_out_threshold_minutes: Number(data?.attendance_early_out_threshold_minutes ?? 30),
    attendance_break_overage_threshold_minutes: Number(data?.attendance_break_overage_threshold_minutes ?? 15),
    performance_allowance_amount: Number(data?.performance_allowance_amount ?? 100),
    performance_allowance_mode: (data?.performance_allowance_mode as "tiered" | "linear") ?? "tiered",
    performance_tier_full_threshold: Number(data?.performance_tier_full_threshold ?? 85),
    performance_tier_half_threshold: Number(data?.performance_tier_half_threshold ?? 70),
    performance_tier_quarter_threshold: Number(data?.performance_tier_quarter_threshold ?? 60),
  };
}

export async function computeAllowancesForUser(
  userId: string,
  year: number,
  month: number,
  rules?: AllowanceRules,
): Promise<AllowanceBreakdown> {
  const r = rules ?? (await loadAllowanceRules());

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const endForElapsed = isCurrentMonth ? today : monthEndDate;
  const daysElapsed = Math.min(endForElapsed.getDate(), monthEndDate.getDate());
  const daysRemaining = Math.max(0, monthEndDate.getDate() - daysElapsed);

  // 1. Attendance logs
  const { data: logs } = await hrSupabaseAdmin
    .from("hr_attendance_logs")
    .select("id, clock_in, clock_out, lateness_minutes, ai_flags, final_status, scheduled_start, scheduled_end")
    .eq("user_id", userId)
    .gte("clock_in", `${monthStart}T00:00:00Z`)
    .lte("clock_in", `${monthEnd}T23:59:59Z`);

  // 2. Scheduled shifts that should have had attendance but didn't (no-show detection)
  const { data: scheduled } = await hrSupabaseAdmin
    .from("hr_schedule_shifts")
    .select("shift_date, start_time, end_time")
    .eq("user_id", userId)
    .gte("shift_date", monthStart)
    .lte("shift_date", monthEnd);

  // 3. Approved leaves — don't count as absence
  const { data: leaves } = await hrSupabaseAdmin
    .from("hr_leave_requests")
    .select("start_date, end_date")
    .eq("user_id", userId)
    .in("status", ["approved", "ai_approved"])
    .gte("start_date", monthStart)
    .lte("end_date", monthEnd);
  const leaveDays = new Set<string>();
  (leaves || []).forEach((l: { start_date: string; end_date: string }) => {
    const s = new Date(l.start_date);
    const e = new Date(l.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      leaveDays.add(d.toISOString().slice(0, 10));
    }
  });

  // 4. Apply attendance penalties
  const penalties: AllowanceBreakdown["attendance"]["penalties"] = [];
  const metrics = { lateCount: 0, absentCount: 0, earlyOutCount: 0, missedClockoutCount: 0, exceededBreakCount: 0 };

  const minutesBetween = (a: string | null, b: string | null) => {
    if (!a || !b) return 0;
    return (new Date(a).getTime() - new Date(b).getTime()) / 60000;
  };

  for (const log of (logs || [])) {
    const date = log.clock_in?.slice(0, 10);
    // Late clock-in
    if ((log.lateness_minutes || 0) > r.attendance_late_threshold_minutes) {
      penalties.push({ kind: "late", label: `Late by ${log.lateness_minutes}m`, amount: r.attendance_penalty_late, date });
      metrics.lateCount++;
    }
    // Missed clock-out
    if (!log.clock_out) {
      penalties.push({ kind: "missed_clockout", label: "Missed clock-out", amount: r.attendance_penalty_missed_clockout, date });
      metrics.missedClockoutCount++;
    } else if (log.scheduled_end) {
      // Early out
      const earlyMin = -minutesBetween(log.clock_out, log.scheduled_end);
      if (earlyMin > r.attendance_early_out_threshold_minutes) {
        penalties.push({ kind: "early_out", label: `Left ${Math.round(earlyMin)}m early`, amount: r.attendance_penalty_early_out, date });
        metrics.earlyOutCount++;
      }
    }
    // Exceeded break — stored in ai_flags
    if (Array.isArray(log.ai_flags) && log.ai_flags.includes("exceeded_break")) {
      penalties.push({ kind: "exceeded_break", label: "Exceeded break", amount: r.attendance_penalty_exceeded_break, date });
      metrics.exceededBreakCount++;
    }
  }

  // No-shows: scheduled shifts in the past with no attendance log for that date and not on leave
  const loggedDates = new Set((logs || []).map((l: { clock_in: string }) => l.clock_in?.slice(0, 10)));
  const todayIso = today.toISOString().slice(0, 10);
  for (const sh of (scheduled || [])) {
    if (sh.shift_date >= todayIso) continue; // future shifts don't count yet
    if (loggedDates.has(sh.shift_date)) continue;
    if (leaveDays.has(sh.shift_date)) continue;
    penalties.push({ kind: "absent", label: "No-show (scheduled, didn't clock in)", amount: r.attendance_penalty_absent, date: sh.shift_date });
    metrics.absentCount++;
  }

  const attendanceDeducted = penalties.reduce((s, p) => s + p.amount, 0);
  const attendanceEarned = Math.max(0, r.attendance_allowance_amount - attendanceDeducted);

  // Attendance tip
  let attendanceTip = "Perfect attendance so far — keep it up!";
  if (metrics.absentCount > 0) attendanceTip = `You've missed ${metrics.absentCount} scheduled shift${metrics.absentCount > 1 ? "s" : ""}. Attend all remaining shifts to protect your allowance.`;
  else if (metrics.lateCount > 0) attendanceTip = `Be on time for the next ${Math.min(3, daysRemaining)} clock-ins to stay on track.`;
  else if (metrics.earlyOutCount > 0) attendanceTip = "Avoid leaving before your scheduled end-time.";

  // 5. Performance — reuse the composite score. Compute inline to avoid circular dep.
  const score = await computePerformanceScore(userId, year, month);

  let performanceEarned = 0;
  if (r.performance_allowance_mode === "linear") {
    performanceEarned = Math.round(r.performance_allowance_amount * (score / 100) * 100) / 100;
  } else {
    // tiered
    if (score >= r.performance_tier_full_threshold) performanceEarned = r.performance_allowance_amount;
    else if (score >= r.performance_tier_half_threshold) performanceEarned = r.performance_allowance_amount / 2;
    else if (score >= r.performance_tier_quarter_threshold) performanceEarned = r.performance_allowance_amount / 4;
    else performanceEarned = 0;
  }

  let performanceTip = "";
  if (r.performance_allowance_mode === "tiered") {
    if (score < r.performance_tier_quarter_threshold) performanceTip = `Reach ${r.performance_tier_quarter_threshold}+ to earn RM ${r.performance_allowance_amount / 4}. Focus on punctuality & checklists.`;
    else if (score < r.performance_tier_half_threshold) performanceTip = `Reach ${r.performance_tier_half_threshold}+ for RM ${r.performance_allowance_amount / 2}.`;
    else if (score < r.performance_tier_full_threshold) performanceTip = `Reach ${r.performance_tier_full_threshold}+ for the full RM ${r.performance_allowance_amount}.`;
    else performanceTip = "You've hit the top tier — well done!";
  } else {
    performanceTip = score < 100 ? `Every point = RM ${(r.performance_allowance_amount / 100).toFixed(2)}.` : "Perfect score!";
  }

  return {
    userId,
    period: { year, month, daysElapsed, daysRemaining },
    attendance: {
      base: r.attendance_allowance_amount,
      earned: attendanceEarned,
      penalties,
      metrics,
      tip: attendanceTip,
    },
    performance: {
      base: r.performance_allowance_amount,
      earned: performanceEarned,
      score,
      mode: r.performance_allowance_mode,
      tip: performanceTip,
    },
    totalEarned: Math.round((attendanceEarned + performanceEarned) * 100) / 100,
    totalMax: r.attendance_allowance_amount + r.performance_allowance_amount,
  };
}

// Lightweight performance score — shares logic with /api/hr/performance but inlined for efficiency.
async function computePerformanceScore(userId: string, year: number, month: number): Promise<number> {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
  const monthStartIso = `${monthStart}T00:00:00Z`;
  const monthEndIso = `${monthEnd}T23:59:59Z`;

  const [attResp, schedResp, checklists, auditReports, user] = await Promise.all([
    hrSupabaseAdmin.from("hr_attendance_logs").select("lateness_minutes, regular_hours, overtime_hours").eq("user_id", userId).gte("clock_in", monthStartIso).lte("clock_in", monthEndIso),
    hrSupabaseAdmin.from("hr_schedule_shifts").select("start_time, end_time, break_minutes").eq("user_id", userId).gte("shift_date", monthStart).lte("shift_date", monthEnd),
    prisma.checklist.findMany({
      where: { assignedToId: userId, createdAt: { gte: new Date(monthStartIso), lte: new Date(monthEndIso) } },
      select: { status: true },
    }),
    prisma.auditReport.findMany({
      where: { completedAt: { gte: new Date(monthStartIso), lte: new Date(monthEndIso) }, status: "COMPLETED" },
      select: { overallScore: true, overallNotes: true, items: { select: { notes: true, rating: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, fullName: true, outletId: true } }),
  ]);

  const logs = attResp.data || [];
  const scheduled = schedResp.data || [];

  const clockIns = logs.length;
  const totalLateMin = logs.reduce((s: number, l: { lateness_minutes: number | null }) => s + (l.lateness_minutes || 0), 0);
  const avgLateMin = clockIns > 0 ? totalLateMin / clockIns : 0;
  const actualHours = logs.reduce((s: number, l: { regular_hours: number | null }) => s + Number(l.regular_hours || 0), 0);
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const scheduledHours = scheduled.reduce((s: number, sh: { start_time: string; end_time: string; break_minutes: number | null }) => s + Math.max(0, (toMin(sh.end_time) - toMin(sh.start_time) - (sh.break_minutes || 0)) / 60), 0);
  const opsRate = checklists.length > 0 ? (checklists.filter((c) => c.status === "COMPLETED").length / checklists.length) * 100 : 0;

  // Reviews
  let reviewRating = 0;
  let reviewCount = 0;
  if (user?.outletId) {
    try {
      const rs = await prisma.reviewSettings.findUnique({ where: { outletId: user.outletId }, select: { gbpAccountId: true, gbpLocationName: true } });
      if (rs?.gbpAccountId && rs.gbpLocationName) {
        const data = await fetchGoogleReviews(rs.gbpAccountId, rs.gbpLocationName, 50);
        for (const r of (data.reviews || [])) {
          if (r.createdAt >= monthStartIso && r.createdAt <= monthEndIso) {
            reviewRating = (reviewRating * reviewCount + r.rating) / (reviewCount + 1);
            reviewCount++;
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Audit adjustments
  let auditPositive = 0;
  let auditNegative = 0;
  const tokens = [user?.name, user?.fullName, user?.name?.split(/\s+/)[0], user?.fullName?.split(/\s+/)[0]].filter((t): t is string => !!t && t.length >= 3);
  for (const rpt of auditReports) {
    const txt = [rpt.overallNotes || "", ...(rpt.items || []).map((i) => i.notes || "")].join(" \n ");
    if (!txt.trim()) continue;
    const hit = tokens.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(txt));
    if (!hit) continue;
    const score = rpt.overallScore ? Number(rpt.overallScore) : null;
    const itemRatings = (rpt.items || []).map((i) => i.rating).filter((r): r is number => r != null);
    const avgItem = itemRatings.length > 0 ? itemRatings.reduce((a, b) => a + b, 0) / itemRatings.length : null;
    if ((score !== null && score >= 80) || (avgItem !== null && avgItem >= 4)) auditPositive++;
    else if ((score !== null && score < 60) || (avgItem !== null && avgItem <= 2)) auditNegative++;
  }

  const punctuality = Math.max(0, 100 - avgLateMin * 5);
  const hoursEff = scheduledHours > 0 ? Math.min(100, (actualHours / scheduledHours) * 100) : (actualHours > 0 ? 100 : 0);
  const reviewScore = reviewCount > 0 ? reviewRating * 20 : 60;
  const auditAdj = Math.max(-15, Math.min(15, auditPositive * 5 - auditNegative * 10));

  let score = Math.round(punctuality * 0.3 + hoursEff * 0.2 + opsRate * 0.2 + reviewScore * 0.2 + 10 + auditAdj);
  score = Math.max(0, Math.min(100, score));
  return score;
}
