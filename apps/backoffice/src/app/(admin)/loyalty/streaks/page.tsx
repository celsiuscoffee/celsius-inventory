"use client";

import { useEffect, useState } from "react";
import { Flame, Users, Trophy, Shield } from "lucide-react";

interface StreakRow {
  member_id: string;
  current_streak_weeks: number;
  longest_streak_weeks: number;
  last_order_week_start: string | null;
  saver_available: boolean;
}

interface StreaksResponse {
  summary: {
    active_streakers: number;
    longest_streak_weeks: number;
    savers_available: number;
    total_tracked: number;
  };
  leaderboard: StreakRow[];
}

export default function StreaksPage() {
  const [data, setData] = useState<StreaksResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/loyalty/streaks`, { credentials: "include" });
        setData(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Flame className="w-6 h-6" />
          Streaks
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Weekly visit streaks. Members who order at least once per week increment their streak;
          the nightly cron either bumps or burns it. Each member gets one "streak saver" per quarter
          that absorbs a missed week. Hard-coded behavior — no per-member config here.
        </p>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Users} label="Active streakers"  value={data.summary.active_streakers.toString()} />
            <Stat icon={Trophy} label="Longest streak"    value={`${data.summary.longest_streak_weeks} wks`} />
            <Stat icon={Shield} label="Savers available"  value={data.summary.savers_available.toString()} />
            <Stat icon={Flame} label="Total tracked"      value={data.summary.total_tracked.toString()} />
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Top streakers</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Member</th>
                  <th className="text-right px-4 py-2">Current</th>
                  <th className="text-right px-4 py-2">Longest</th>
                  <th className="text-left px-4 py-2">Last week</th>
                  <th className="text-center px-4 py-2">Saver</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.leaderboard.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No streaks yet</td></tr>
                ) : (
                  data.leaderboard.map((s) => (
                    <tr key={s.member_id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-mono text-xs">{s.member_id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{s.current_streak_weeks}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.longest_streak_weeks}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {s.last_order_week_start ? new Date(s.last_order_week_start).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {s.saver_available
                          ? <span className="text-emerald-500">●</span>
                          : <span className="text-muted-foreground">○</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            <p>
              Streak cron runs daily via <code className="bg-muted px-1.5 rounded">/api/cron/streak-update</code> in the order app.
              Customers see their current streak inline with the Beans hero on the Rewards screen.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
