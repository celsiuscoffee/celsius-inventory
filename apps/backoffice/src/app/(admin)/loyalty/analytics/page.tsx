"use client";

import { useEffect, useState } from "react";
import { BarChart3, Target, Sparkles, Ticket, Users, Flame } from "lucide-react";

interface AnalyticsResponse {
  range: { since: string; generated_at: string };
  missions: {
    total: number;
    active: number;
    rows: Array<{
      id: string; title: string; difficulty: string;
      picked: number; completed: number; completion_rate: number; is_active: boolean;
    }>;
  };
  mystery: {
    total_drops: number; revealed: number; reveal_rate: number;
    distribution: Array<{ type: string; count: number; pct: number }>;
  };
  vouchers: {
    total_issued: number; total_redeemed: number;
    by_source: Array<{ source: string; issued: number; redeemed: number; expired: number; redemption_rate: number }>;
  };
  referrals: { total: number; pending: number; rewarded: number; voided: number };
  streaks: { zero: number; "1_3": number; "4_7": number; "8_plus": number };
}

const BRAND_ID = "brand-celsius";

export default function V2AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/loyalty/v2-analytics?brand_id=${BRAND_ID}`, { credentials: "include" });
        setData(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Rewards v2 — Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Last 30 days. Mission completion, mystery distribution, voucher funnel by source,
          referral attribution, streak buckets.
        </p>
      </div>

      {loading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi icon={Target}    label="Missions active"   value={`${data.missions.active}/${data.missions.total}`} />
            <Kpi icon={Sparkles}  label="Mystery reveal rate" value={`${data.mystery.reveal_rate}%`}
                 sub={`${data.mystery.revealed}/${data.mystery.total_drops}`} />
            <Kpi icon={Ticket}    label="Vouchers issued"   value={data.vouchers.total_issued.toString()}
                 sub={`${data.vouchers.total_redeemed} redeemed`} />
            <Kpi icon={Users}     label="Referrals rewarded" value={`${data.referrals.rewarded}`}
                 sub={`${data.referrals.pending} pending`} />
          </div>

          {/* Missions table */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Mission completion rates</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Mission</th>
                  <th className="text-left px-4 py-2">Difficulty</th>
                  <th className="text-right px-4 py-2">Picked</th>
                  <th className="text-right px-4 py-2">Completed</th>
                  <th className="text-right px-4 py-2">Rate</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.missions.rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No missions yet</td></tr>
                ) : (
                  data.missions.rows.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{m.title}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          m.difficulty === "easy"   ? "bg-emerald-500/10 text-emerald-600" :
                          m.difficulty === "medium" ? "bg-amber-500/10 text-amber-600" :
                                                      "bg-rose-500/10 text-rose-600"
                        }`}>{m.difficulty}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{m.picked}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{m.completed}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{m.completion_rate}%</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs ${m.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {m.is_active ? "● Active" : "○ Paused"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* Mystery distribution */}
          <section className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Mystery outcome distribution (30 days)
            </h3>
            {data.mystery.distribution.length === 0 ? (
              <div className="text-sm text-muted-foreground">No drops yet</div>
            ) : (
              <div className="space-y-2">
                {data.mystery.distribution.map((d) => (
                  <div key={d.type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{d.type}</span>
                      <span className="text-muted-foreground tabular-nums">{d.count} · {d.pct}%</span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-foreground" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Voucher funnel by source */}
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Voucher funnel by source (30 days)</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Source</th>
                  <th className="text-right px-4 py-2">Issued</th>
                  <th className="text-right px-4 py-2">Redeemed</th>
                  <th className="text-right px-4 py-2">Expired</th>
                  <th className="text-right px-4 py-2">Redemption %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.vouchers.by_source.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No vouchers issued yet</td></tr>
                ) : (
                  data.vouchers.by_source.map((v) => (
                    <tr key={v.source} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium capitalize">{v.source.replace("_", " ")}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{v.issued}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{v.redeemed}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{v.expired}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{v.redemption_rate}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* Streak buckets */}
          <section className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4" /> Streak distribution
            </h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              <Bucket label="0 wks"    value={data.streaks.zero} />
              <Bucket label="1–3 wks"  value={data.streaks["1_3"]} />
              <Bucket label="4–7 wks"  value={data.streaks["4_7"]} />
              <Bucket label="8+ wks"   value={data.streaks["8_plus"]} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
