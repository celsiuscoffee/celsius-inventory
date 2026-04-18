// Staff-app allowance computation. Mirrors logic in apps/backoffice/src/lib/hr/allowances.ts
// Uses the staff app's Supabase client + Prisma.
import { supabase } from "../supabase";
import { prisma } from "../prisma";

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

async function loadRules() {
  const { data } = await supabase
    .from("hr_company_settings")
    .select("attendance_allowance_amount, attendance_penalty_late, attendance_penalty_absent, attendance_penalty_early_out, attendance_penalty_missed_clockout, attendance_penalty_exceeded_break, attendance_late_threshold_minutes, attendance_early_out_threshold_minutes, performance_allowance_amount, performance_allowance_mode, performance_tier_full_threshold, performance_tier_half_threshold, performance_tier_quarter_threshold")
    .limit(1)
    .maybeSingle();
  return {
    attBase: Number(data?.attendance_allowance_amount ?? 100),
    penLate: Number(data?.attendance_penalty_late ?? 5),
    penAbsent: Number(data?.attendance_penalty_absent ?? 20),
    penEarlyOut: Number(data?.attendance_penalty_early_out ?? 10),
    penMissedClockout: Number(data?.attendance_penalty_missed_clockout ?? 5),
    penExceededBreak: Number(data?.attendance_penalty_exceeded_break ?? 3),
    lateThresh: Number(data?.attendance_late_threshold_minutes ?? 5),
    earlyOutThresh: Number(data?.attendance_early_out_threshold_minutes ?? 30),
    perfBase: Number(data?.performance_allowance_amount ?? 100),
    perfMode: (data?.performance_allowance_mode as "tiered" | "linear") ?? "tiered",
    tierFull: Number(data?.performance_tier_full_threshold ?? 85),
    tierHalf: Number(data?.performance_tier_half_threshold ?? 70),
    tierQuarter: Number(data?.performance_tier_quarter_threshold ?? 60),
  };
}

export async function computeAllowances(userId: string, year: number, month: number): Promise<AllowanceBreakdown> {
  const r = await loadRules();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const today = new Date();
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month;
  const endForElapsed = isCurrent ? today : monthEndDate;
  const daysElapsed = Math.min(endForElapsed.getDate(), monthEndDate.getDate());
  const daysRemaining = Math.max(0, monthEndDate.getDate() - daysElapsed);

  const [attResp, schedResp, leavesResp] = await Promise.all([
    supabase.from("hr_attendance_logs").select("id, clock_in, clock_out, lateness_minutes, ai_flags, scheduled_end, regular_hours").eq("user_id", userId).gte("clock_in", `${monthStart}T00:00:00Z`).lte("clock_in", `${monthEnd}T23:59:59Z`),
    supabase.from("hr_schedule_shifts").select("shift_date, start_time, end_time, break_minutes").eq("user_id", userId).gte("shift_date", monthStart).lte("shift_date", monthEnd),
    supabase.from("hr_leave_requests").select("start_date, end_date").eq("user_id", userId).in("status", ["approved", "ai_approved"]).gte("start_date", monthStart).lte("end_date", monthEnd),
  ]);

  const logs = (attResp.data || []) as { id: string; clock_in: string; clock_out: string | null; lateness_minutes: number | null; ai_flags: string[] | null; scheduled_end: string | null; regular_hours: number | null }[];
  const scheduled = (schedResp.data || []) as { shift_date: string; start_time: string; end_time: string; break_minutes: number | null }[];
  const leaves = (leavesResp.data || []) as { start_date: string; end_date: string }[];

  const leaveDays = new Set<string>();
  leaves.forEach((l) => {
    const s = new Date(l.start_date);
    const e = new Date(l.end_date);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      leaveDays.add(d.toISOString().slice(0, 10));
    }
  });

  const penalties: AllowanceBreakdown["attendance"]["penalties"] = [];
  const metrics = { lateCount: 0, absentCount: 0, earlyOutCount: 0, missedClockoutCount: 0, exceededBreakCount: 0 };

  for (const log of logs) {
    const date = log.clock_in?.slice(0, 10);
    if ((log.lateness_minutes || 0) > r.lateThresh) {
      penalties.push({ kind: "late", label: `Late by ${log.lateness_minutes}m`, amount: r.penLate, date });
      metrics.lateCount++;
    }
    if (!log.clock_out) {
      penalties.push({ kind: "missed_clockout", label: "Missed clock-out", amount: r.penMissedClockout, date });
      metrics.missedClockoutCount++;
    } else if (log.scheduled_end) {
      const earlyMin = (new Date(log.scheduled_end).getTime() - new Date(log.clock_out).getTime()) / 60000;
      if (earlyMin > r.earlyOutThresh) {
        penalties.push({ kind: "early_out", label: `Left ${Math.round(earlyMin)}m early`, amount: r.penEarlyOut, date });
        metrics.earlyOutCount++;
      }
    }
    if (Array.isArray(log.ai_flags) && log.ai_flags.includes("exceeded_break")) {
      penalties.push({ kind: "exceeded_break", label: "Exceeded break", amount: r.penExceededBreak, date });
      metrics.exceededBreakCount++;
    }
  }

  const loggedDates = new Set(logs.map((l) => l.clock_in?.slice(0, 10)));
  const todayIso = today.toISOString().slice(0, 10);
  for (const sh of scheduled) {
    if (sh.shift_date >= todayIso) continue;
    if (loggedDates.has(sh.shift_date)) continue;
    if (leaveDays.has(sh.shift_date)) continue;
    penalties.push({ kind: "absent", label: "No-show", amount: r.penAbsent, date: sh.shift_date });
    metrics.absentCount++;
  }

  const attendanceEarned = Math.max(0, r.attBase - penalties.reduce((s, p) => s + p.amount, 0));

  let attendanceTip = "Perfect attendance — keep it up!";
  if (metrics.absentCount > 0) attendanceTip = `You missed ${metrics.absentCount} shift${metrics.absentCount > 1 ? "s" : ""}. Attend the rest to protect your allowance.`;
  else if (metrics.lateCount > 0) attendanceTip = `Be on time for the next ${Math.min(3, daysRemaining)} clock-ins to stay on track.`;
  else if (metrics.earlyOutCount > 0) attendanceTip = "Avoid leaving before your scheduled end-time.";

  // Performance score — simplified local computation (punctuality + hours + ops)
  const score = await computeScore(userId, year, month, logs, scheduled);

  let performanceEarned = 0;
  if (r.perfMode === "linear") {
    performanceEarned = Math.round(r.perfBase * (score / 100) * 100) / 100;
  } else {
    if (score >= r.tierFull) performanceEarned = r.perfBase;
    else if (score >= r.tierHalf) performanceEarned = r.perfBase / 2;
    else if (score >= r.tierQuarter) performanceEarned = r.perfBase / 4;
    else performanceEarned = 0;
  }

  let performanceTip = "";
  if (r.perfMode === "tiered") {
    if (score < r.tierQuarter) performanceTip = `Reach ${r.tierQuarter}+ to earn RM ${r.perfBase / 4}.`;
    else if (score < r.tierHalf) performanceTip = `Reach ${r.tierHalf}+ for RM ${r.perfBase / 2}.`;
    else if (score < r.tierFull) performanceTip = `Reach ${r.tierFull}+ for the full RM ${r.perfBase}.`;
    else performanceTip = "Top tier — amazing!";
  } else {
    performanceTip = `Every point = RM ${(r.perfBase / 100).toFixed(2)}.`;
  }

  return {
    userId,
    period: { year, month, daysElapsed, daysRemaining },
    attendance: { base: r.attBase, earned: attendanceEarned, penalties, metrics, tip: attendanceTip },
    performance: { base: r.perfBase, earned: performanceEarned, score, mode: r.perfMode, tip: performanceTip },
    totalEarned: Math.round((attendanceEarned + performanceEarned) * 100) / 100,
    totalMax: r.attBase + r.perfBase,
  };
}

async function computeScore(
  userId: string,
  year: number,
  month: number,
  logs: { lateness_minutes: number | null; regular_hours: number | null }[],
  scheduled: { start_time: string; end_time: string; break_minutes: number | null }[],
): Promise<number> {
  const monthStartIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
  const monthEndIso = `${monthEnd}T23:59:59Z`;

  const clockIns = logs.length;
  const totalLateMin = logs.reduce((s: number, l) => s + (l.lateness_minutes || 0), 0);
  const avgLateMin = clockIns > 0 ? totalLateMin / clockIns : 0;
  const actualHours = logs.reduce((s: number, l) => s + Number(l.regular_hours || 0), 0);
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const scheduledHours = scheduled.reduce((s: number, sh) => s + Math.max(0, (toMin(sh.end_time) - toMin(sh.start_time) - (sh.break_minutes || 0)) / 60), 0);

  let opsRate = 0;
  try {
    const checklists = await prisma.checklist.findMany({
      where: { assignedToId: userId, createdAt: { gte: new Date(monthStartIso), lte: new Date(monthEndIso) } },
      select: { status: true },
    });
    opsRate = checklists.length > 0 ? (checklists.filter((c) => c.status === "COMPLETED").length / checklists.length) * 100 : 0;
  } catch { /* ignore */ }

  const punctuality = Math.max(0, 100 - avgLateMin * 5);
  const hoursEff = scheduledHours > 0 ? Math.min(100, (actualHours / scheduledHours) * 100) : (actualHours > 0 ? 100 : 0);
  const reviewScore = 60; // staff app doesn't fetch GBP — use neutral

  let score = Math.round(punctuality * 0.3 + hoursEff * 0.2 + opsRate * 0.2 + reviewScore * 0.2 + 10);
  score = Math.max(0, Math.min(100, score));
  return score;
}
