"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const supabase = createClient();

export default function PromotionsPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("pos_promotions").select("*").order("created_at", { ascending: false });
      setPromos(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="mt-1 text-sm text-text-muted">{promos.length} promotions</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-sm text-text-muted">Loading...</div>
      ) : promos.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised text-3xl">🏷️</div>
          <h2 className="mt-4 text-lg font-semibold">No Promotions Yet</h2>
          <p className="mt-2 max-w-sm text-sm text-text-muted">
            Promotions can be created and managed here. Configure percentage discounts, buy-X-get-Y deals, combo bundles, and more.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {promos.map((promo) => (
            <div key={promo.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3">
              <div>
                <p className="text-sm font-medium">{promo.name}</p>
                <p className="text-xs text-text-muted">{promo.promo_code ?? "No code"}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${promo.is_enabled ? "bg-success/20 text-success" : "bg-surface text-text-muted"}`}>
                {promo.is_enabled ? "Active" : "Disabled"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
