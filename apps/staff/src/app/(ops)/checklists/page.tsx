"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle, User } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";

type Outlet = { id: string; code: string; name: string; type: string };
type UserProfile = { id: string; name: string; role: string };

type ChecklistSummary = {
  id: string;
  date: string;
  shift: "OPENING" | "MIDDAY" | "CLOSING";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  sop: { id: string; title: string; category: { name: string } };
  outlet: { id: string; code: string; name: string };
  assignedTo: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  completedAt: string | null;
  totalItems: number;
  completedItems: number;
  progress: number;
};

const SHIFT_LABELS: Record<string, string> = {
  OPENING: "Opening",
  MIDDAY: "Midday",
  CLOSING: "Closing",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
  IN_PROGRESS: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100" },
  COMPLETED: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
};

export default function ChecklistsPage() {
  const { data: outlets } = useFetch<Outlet[]>("/api/outlets");
  const { data: me } = useFetch<UserProfile>("/api/auth/me");
  const [selectedOutlet, setSelectedOutlet] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("OPENING");
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (outlets && outlets.length > 0 && !selectedOutlet) {
      setSelectedOutlet(outlets[0].id);
    }
  }, [outlets, selectedOutlet]);

  // For staff, always show "mine". Managers can toggle.
  const isManager = me && ["OWNER", "ADMIN", "MANAGER"].includes(me.role);

  let queryUrl = selectedOutlet
    ? `/api/checklists?outletId=${selectedOutlet}&date=${today}&shift=${selectedShift}`
    : null;
  if (queryUrl && viewMode === "mine") queryUrl += "&mine=true";

  const { data: checklists, isLoading, mutate } = useFetch<ChecklistSummary[]>(queryUrl);

  const handleGenerate = async () => {
    if (!selectedOutlet) return;
    setGenerating(true);
    try {
      await fetch("/api/checklists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId: selectedOutlet, date: today, shift: selectedShift }),
      });
      mutate();
    } finally {
      setGenerating(false);
    }
  };

  const completedCount = checklists?.filter((c) => c.status === "COMPLETED").length ?? 0;
  const totalCount = checklists?.length ?? 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Today&apos;s Checklists</h1>
        <p className="mt-1 text-sm text-muted-foreground">{today}</p>
      </div>

      {/* View toggle */}
      {isManager && (
        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-0.5 w-fit">
          <button
            onClick={() => setViewMode("mine")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "mine" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            My Checklists
          </button>
          <button
            onClick={() => setViewMode("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "all" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            All Staff
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={selectedOutlet}
          onChange={(e) => setSelectedOutlet(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select Outlet</option>
          {outlets?.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="OPENING">Opening</option>
          <option value="MIDDAY">Midday</option>
          <option value="CLOSING">Closing</option>
        </select>
        {isManager && (
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || !selectedOutlet}
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Generate Checklists
          </Button>
        )}
      </div>

      {/* Progress summary */}
      {checklists && checklists.length > 0 && (
        <div className="mb-5 flex items-center gap-3">
          <div className="flex-1 rounded-full bg-muted h-2.5 overflow-hidden">
            <div
              className="h-full bg-terracotta rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
        </div>
      )}

      {/* Checklist cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !checklists || checklists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No checklists for this shift yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {isManager
                ? 'Set up schedules first, then click "Generate Checklists"'
                : "Your manager will assign checklists to you"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {checklists.map((cl) => {
            const config = STATUS_CONFIG[cl.status];
            const Icon = config.icon;
            return (
              <Link key={cl.id} href={`/checklists/${cl.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2 ${config.bg}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{cl.sop.title}</h3>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{cl.sop.category.name}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{SHIFT_LABELS[cl.shift]} shift</span>
                          <span>{cl.completedItems}/{cl.totalItems} items</span>
                          {cl.assignedTo && viewMode === "all" && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />{cl.assignedTo.name}
                            </span>
                          )}
                          {cl.completedBy && <span>by {cl.completedBy.name}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-foreground">{cl.progress}%</div>
                        <div className={`text-[10px] font-medium ${config.color}`}>{cl.status.replace("_", " ")}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-full bg-muted h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cl.status === "COMPLETED" ? "bg-green-500" : "bg-terracotta"
                        }`}
                        style={{ width: `${cl.progress}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
