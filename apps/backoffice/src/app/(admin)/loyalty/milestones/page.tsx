"use client";

import { useState, useEffect } from "react";
import { Trophy, Plus, Pencil, Trash2, X } from "lucide-react";

type TriggerType = "lifetime_orders" | "lifetime_beans" | "distinct_outlets" | "streak_weeks";

interface Milestone {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  icon: string;
  trigger_type: TriggerType;
  trigger_value: number;
  reward_voucher_template_ids: string[];
  reward_bonus_beans: number;
  reward_unlock: string | null;
  is_active: boolean;
}

interface VoucherTemplate { id: string; title: string; category: string }

const BRAND_ID = "brand-celsius";
const TRIGGER_LABELS: Record<TriggerType, string> = {
  lifetime_orders:  "Lifetime orders",
  lifetime_beans:   "Lifetime Beans earned",
  distinct_outlets: "Distinct outlets visited",
  streak_weeks:     "Longest streak (weeks)",
};

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/loyalty/milestones?brand_id=${BRAND_ID}`, { credentials: "include" }),
        fetch(`/api/loyalty/voucher-templates?brand_id=${BRAND_ID}`, { credentials: "include" }),
      ]);
      setMilestones(await r1.json());
      setTemplates(await r2.json());
    } catch { setMilestones([]); setTemplates([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this milestone? Members who already earned it keep their reward.")) return;
    await fetch(`/api/loyalty/milestones?id=${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Milestones
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Lifetime achievements — 50 cups, 200 cups, 500 cups, distinct outlets, longest streak.
            Trophies that reward long-term loyalty beyond tiers. Scanned daily by the milestone cron.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New Milestone
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No milestones yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Add lifetime achievement triggers to reward loyal customers.
          </p>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium">
            <Plus className="w-4 h-4" /> Create first milestone
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {milestones.map((m) => (
            <div key={m.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-2 space-y-0.5">
                <div>Trigger: {TRIGGER_LABELS[m.trigger_type]} ≥ <strong>{m.trigger_value}</strong></div>
                {m.reward_voucher_template_ids.length > 0 && <div>Vouchers: {m.reward_voucher_template_ids.length}</div>}
                {m.reward_bonus_beans > 0 && <div>Bonus Beans: +{m.reward_bonus_beans}</div>}
                {m.reward_unlock && <div>Unlock key: <code>{m.reward_unlock}</code></div>}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className={`text-xs ${m.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {m.is_active ? "● Active" : "○ Paused"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(m)} className="p-1.5 hover:bg-muted rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(m.id)} className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <MilestoneModal
          milestone={editing}
          templates={templates}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
        />
      )}
    </div>
  );
}

function MilestoneModal({
  milestone, templates, onClose, onSaved,
}: { milestone: Milestone | null; templates: VoucherTemplate[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(milestone?.trigger_type ?? "lifetime_orders");
  const [triggerValue, setTriggerValue] = useState(milestone?.trigger_value ?? 50);
  const [voucherIds, setVoucherIds] = useState<string[]>(milestone?.reward_voucher_template_ids ?? []);
  const [bonusBeans, setBonusBeans] = useState(milestone?.reward_bonus_beans ?? 0);
  const [rewardUnlock, setRewardUnlock] = useState(milestone?.reward_unlock ?? "");
  const [isActive, setIsActive] = useState(milestone?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const payload = {
        brand_id: BRAND_ID,
        title, description, icon: "trophy",
        trigger_type: triggerType, trigger_value: triggerValue,
        reward_voucher_template_ids: voucherIds,
        reward_bonus_beans: bonusBeans,
        reward_unlock: rewardUnlock || null,
        is_active: isActive,
      };
      const res = milestone
        ? await fetch(`/api/loyalty/milestones`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ id: milestone.id, ...payload }),
          })
        : await fetch(`/api/loyalty/milestones`, {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify(payload),
          });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "Save failed"); return; }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally { setSaving(false); }
  }

  function toggleVoucher(id: string) {
    setVoucherIds((prev) => prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl w-full max-w-lg my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{milestone ? "Edit Milestone" : "New Milestone"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-1.5">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-background" placeholder="e.g. Coffee Veteran" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-1.5">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 bg-background" placeholder="500 lifetime orders" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">Trigger</span>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)} className="w-full border rounded-lg px-3 py-2 bg-background">
                {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">Threshold</span>
              <input type="number" min={1} value={triggerValue} onChange={(e) => setTriggerValue(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 bg-background" />
            </label>
          </div>
          <div className="border rounded-lg p-3 space-y-3 bg-foreground/[0.02]">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reward on earning</div>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground block mb-1.5">Vouchers granted</span>
              {templates.length === 0 ? (
                <div className="text-xs text-muted-foreground">No voucher templates yet.</div>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {templates.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                      <input type="checkbox" checked={voucherIds.includes(t.id)} onChange={() => toggleVoucher(t.id)} />
                      <span className="text-sm">{t.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground block mb-1.5">Bonus Beans</span>
                <input type="number" min={0} value={bonusBeans} onChange={(e) => setBonusBeans(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 bg-background" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground block mb-1.5">Unlock key (optional)</span>
                <input value={rewardUnlock} onChange={(e) => setRewardUnlock(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-background" placeholder="lifetime_platinum" />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm">Active</span>
          </label>
          {error && <div className="text-sm text-rose-500">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-muted text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : milestone ? "Save changes" : "Create milestone"}
          </button>
        </div>
      </div>
    </div>
  );
}
