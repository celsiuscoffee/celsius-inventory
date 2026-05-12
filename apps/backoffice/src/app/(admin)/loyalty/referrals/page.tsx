"use client";

import { useEffect, useState } from "react";
import { Users, Save } from "lucide-react";

interface VoucherTemplate { id: string; title: string; category: string }

const BRAND_ID = "brand-celsius";

export default function ReferralsPage() {
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [referrerTpl, setReferrerTpl] = useState("");
  const [refereeTpl, setRefereeTpl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/loyalty/voucher-templates?brand_id=${BRAND_ID}`, { credentials: "include" }),
          fetch(`/api/loyalty/referral-config`, { credentials: "include" }),
        ]);
        setTemplates(await r1.json());
        const cfg = await r2.json();
        setReferrerTpl(cfg.referrer_template_id ?? "");
        setRefereeTpl(cfg.referee_template_id ?? "");
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/loyalty/referral-config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrer_template_id: referrerTpl || null,
          referee_template_id:  refereeTpl  || null,
        }),
      });
      setSavedAt(Date.now());
    } finally { setSaving(false); }
  }

  const enabled = !!referrerTpl && !!refereeTpl;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="w-6 h-6" />
          Referrals
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Each member gets a unique short code (e.g. <code className="bg-muted px-1 rounded">CC7K2L</code>).
          When a new customer signs up using that code AND completes a paid order, both sides
          are issued the configured voucher templates.
          <br />
          <span className="text-xs text-muted-foreground/80">
            Referrals are disabled until BOTH voucher templates are selected.
          </span>
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-2 uppercase tracking-wide">
              Referrer Reward
            </span>
            <select
              value={referrerTpl}
              onChange={(e) => setReferrerTpl(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 bg-background"
            >
              <option value="">— none —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title} · {t.category}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              The member who shared the code. Issued when their referee places their first paid order.
            </p>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-2 uppercase tracking-wide">
              Referee Reward
            </span>
            <select
              value={refereeTpl}
              onChange={(e) => setRefereeTpl(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 bg-background"
            >
              <option value="">— none —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title} · {t.category}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              The new customer who used the code. Issued on their first paid order so the gift feels earned.
            </p>
          </label>

          <div className="flex items-center gap-3 pt-2 border-t">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save"}
            </button>
            {savedAt && Date.now() - savedAt < 3000 && (
              <span className="text-xs text-emerald-500">Saved</span>
            )}
            <span className={`text-xs ml-auto ${enabled ? "text-emerald-500" : "text-amber-500"}`}>
              {enabled ? "● Referrals active" : "○ Disabled (configure both)"}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <h3 className="text-sm font-semibold mb-2 text-foreground">How it works</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Member shares their code from the app (Rewards → Share &amp; Earn).</li>
          <li>New customer enters the code during signup.</li>
          <li>System records a pending attribution.</li>
          <li>New customer places their first paid order.</li>
          <li>Both sides receive the configured voucher in their wallet.</li>
        </ol>
      </div>
    </div>
  );
}
