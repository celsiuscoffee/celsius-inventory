"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";

type UserProfile = { id: string; name: string; role: string; outletId: string | null };

type ChecklistSummary = {
  id: string;
  date: string;
  shift: "OPENING" | "MIDDAY" | "CLOSING";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  sop: { id: string; title: string; category: { name: string } };
  outlet: { id: string; code: string; name: string };
  assignedTo: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  totalItems: number;
  completedItems: number;
  progress: number;
};

const SHIFT_LABELS: Record<string, string> = { OPENING: "Opening", MIDDAY: "Midday", CLOSING: "Closing" };

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
  IN_PROGRESS: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100" },
  COMPLETED: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
};

export default function ChecklistsPage() {
  const { data: me } = useFetch<UserProfile>("/api/auth/me");
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const isManager = me && ["OWNER", "ADMIN", "MANAGER"].includes(me.role);

  // Staff sees their own checklists; managers see all for their outlet
  const queryUrl = me
    ? `/api/checklists?date=${today}${isManager && me.outletId ? `&outletId=${me.outletId}` : "&mine=true"}`
    : null;

  const { data: checklists, isLoading, mutate } = useFetch<ChecklistSummary[]>(queryUrl);

  const handleGenerate = async () => {
    if (!me?.outletId) return;
    setGenerating(true);
    try {
      // Generate for all shifts
      for (const shift of ["OPENING", "MIDDAY", "CLOSING"]) {
        await fetch("/api/checklists/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outletId: me.outletId, date: today, shift }),
        });
      }
      mutate();
    } finally {
      setGenerating(false);
    }
  };

  const completedCount = checklists?.filter((c) => c.status === "COMPLETED").length ?? 0;
  const totalCount = checklists?.length ?? 0;

  // Group by shift
  const grouped = (checklists ?? []).reduce<Record<string, ChecklistSummary[]>>((acc, cl) => {
    if (!acc[cl.shift]) acc[cl.shift] = [];
    acc[cl.shift].push(cl);
    return acc;
  }, {});

  return (
    <div className="px-4 py-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-brand-dark">Checklists</h1>
            <p className="text-sm text-gray-500">{today}</p>
          </div>
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs"
            >
              {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Generate
            </Button>
          )}
        </div>

        {/* Progress */}
        {checklists && checklists.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full bg-gray-100 h-2 overflow-hidden">
              <div
                className="h-full bg-terracotta rounded-full transition-all"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500">
              {completedCount}/{totalCount}
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!checklists || checklists.length === 0) && (
          <Card className="px-4 py-8 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No checklists today</p>
            <p className="mt-1 text-xs text-gray-400">
              {isManager ? "Tap Generate to create from schedules" : "Check with your manager"}
            </p>
          </Card>
        )}

        {/* Checklists grouped by shift */}
        {["OPENING", "MIDDAY", "CLOSING"].map((shift) => {
          const items = grouped[shift];
          if (!items || items.length === 0) return null;
          return (
            <div key={shift}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {SHIFT_LABELS[shift]} Shift
              </h2>
              <div className="space-y-2">
                {items.map((cl) => {
                  const config = STATUS_CONFIG[cl.status];
                  const Icon = config.icon;
                  return (
                    <Link key={cl.id} href={`/checklists/${cl.id}`}>
                      <Card className="px-3 py-2.5 transition-all active:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{cl.sop.title}</p>
                            <p className="text-[10px] text-gray-400">
                              {cl.sop.category.name} · {cl.completedItems}/{cl.totalItems} items
                              {cl.assignedTo && isManager && ` · ${cl.assignedTo.name}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-gray-700">{cl.progress}%</p>
                          </div>
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-2 rounded-full bg-gray-100 h-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${cl.status === "COMPLETED" ? "bg-green-500" : "bg-terracotta"}`}
                            style={{ width: `${cl.progress}%` }}
                          />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* History link */}
        {checklists && checklists.length > 0 && (
          <Link href="/checklists/history" className="block text-center text-xs text-terracotta py-2">
            View history →
          </Link>
        )}
      </div>
    </div>
  );
}
