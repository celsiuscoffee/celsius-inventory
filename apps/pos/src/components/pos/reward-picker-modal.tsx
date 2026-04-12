"use client";

import { useState, useEffect } from "react";
import { displayRM } from "@/types/database";

type Reward = {
  id: string;
  name: string;
  description?: string | null;
  points_required: number;
  discount_type?: string | null;
  discount_value?: number | null;
  max_discount_value?: number | null;
  free_product_name?: string | null;
  image_url?: string | null;
  // For issued rewards
  issued_reward_id?: string;
  code?: string;
  expires_at?: string | null;
  is_issued?: boolean;
};

type RewardDiscount = {
  type: string;
  value: number;
  max_discount: number | null;
  min_order: number | null;
  applicable_products: string[] | null;
  applicable_categories: string[] | null;
  free_product_ids: string[] | null;
  free_product_name: string | null;
  note?: string;
};

type Props = {
  memberId: string;
  memberName: string | null;
  outletId: string;
  subtotal: number; // in sen
  onRedeem: (result: {
    reward_name: string;
    redemption_id: string;
    discount: RewardDiscount;
    new_balance: number;
  }) => void;
  onClose: () => void;
};

export function RewardPickerModal({ memberId, memberName, outletId, subtotal, onRedeem, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [issued, setIssued] = useState<Reward[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/loyalty/rewards?member_id=${memberId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBalance(data.balance);
        setCatalog(data.catalog ?? []);
        setIssued(data.issued ?? []);
      } catch (err: any) {
        setError(err.message ?? "Failed to load rewards");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [memberId]);

  async function handleRedeem(reward: Reward) {
    setRedeeming(reward.id);
    setError("");

    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          reward_id: reward.is_issued ? (reward.id ?? reward.issued_reward_id) : reward.id,
          outlet_id: outletId,
          issued_reward_id: reward.issued_reward_id ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onRedeem({
        reward_name: data.reward_name,
        redemption_id: data.redemption_id,
        discount: data.discount,
        new_balance: data.new_balance,
      });
    } catch (err: any) {
      setError(err.message ?? "Redemption failed");
      setRedeeming(null);
    }
  }

  function describeDiscount(r: Reward): string {
    if (r.discount_type === "fixed_amount" && r.discount_value) return `RM${r.discount_value} off`;
    if (r.discount_type === "percentage" && r.discount_value) return `${r.discount_value}% off`;
    if (r.discount_type === "free_item") return r.free_product_name ?? "Free item";
    // Infer from name for legacy rewards
    const name = (r.name ?? "").toLowerCase();
    if (name.match(/rm\s?\d/)) return `${r.name} off`;
    if (name.includes("free")) return r.name;
    return r.name;
  }

  const allRewards = [...issued, ...catalog];
  const hasRewards = allRewards.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Redeem Reward</h3>
            <p className="text-xs text-text-muted">
              {memberName ?? "Member"} &middot; {balance} pts
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover">&times;</button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-text-muted">Loading rewards...</div>
          ) : error && !hasRewards ? (
            <div className="py-8 text-center text-sm text-danger">{error}</div>
          ) : !hasRewards ? (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">No rewards available</p>
              <p className="mt-1 text-xs text-text-dim">
                {balance} points — earn more to unlock rewards
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Issued rewards (free to use) */}
              {issued.map((r) => (
                <button
                  key={r.issued_reward_id ?? r.id}
                  onClick={() => handleRedeem(r)}
                  disabled={!!redeeming}
                  className="flex w-full items-center justify-between rounded-xl border border-brand/30 bg-brand/5 p-3 text-left transition-all hover:border-brand hover:bg-brand/10 disabled:opacity-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand">GIFT</span>
                      <span className="text-sm font-semibold">{r.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{describeDiscount(r)}</p>
                    {r.expires_at && (
                      <p className="mt-0.5 text-[10px] text-warning">
                        Expires {new Date(r.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-brand">
                    {redeeming === r.id ? "..." : "FREE"}
                  </span>
                </button>
              ))}

              {/* Catalog rewards (costs points) */}
              {catalog.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleRedeem(r)}
                  disabled={!!redeeming}
                  className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-all hover:border-brand hover:bg-brand/5 disabled:opacity-50"
                >
                  <div className="flex-1">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <p className="mt-0.5 text-xs text-text-muted">{describeDiscount(r)}</p>
                    {r.description && <p className="mt-0.5 text-[10px] text-text-dim">{r.description}</p>}
                  </div>
                  <span className="whitespace-nowrap text-xs font-bold text-text-muted">
                    {redeeming === r.id ? "..." : `${r.points_required} pts`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && hasRewards && (
            <p className="mt-3 text-center text-xs text-danger">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
