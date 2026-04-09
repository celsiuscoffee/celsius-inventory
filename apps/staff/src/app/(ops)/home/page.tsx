"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Package,
  ArrowRight,
  Loader2,
  Trash2,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

type UserProfile = {
  id: string;
  name: string;
  role: string;
  outletId: string | null;
  outletName?: string | null;
};

type ChecklistSummary = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  sop: { title: string; category: { name: string } };
  totalItems: number;
  completedItems: number;
  progress: number;
};

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checklists, setChecklists] = useState<ChecklistSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setUser(data);
        // Fetch today's checklists for this user
        const today = new Date().toISOString().split("T")[0];
        return fetch(`/api/checklists?date=${today}&mine=true`);
      })
      .then((r) => r.json())
      .then((cls) => { if (Array.isArray(cls)) setChecklists(cls); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const pendingChecklists = checklists?.filter((c) => c.status !== "COMPLETED") ?? [];
  const completedCount = checklists?.filter((c) => c.status === "COMPLETED").length ?? 0;
  const totalCount = checklists?.length ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img
            src="/images/celsius-logo-sm.jpg"
            alt="Celsius Coffee"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <h1 className="font-heading text-lg font-bold text-brand-dark">
              {greeting}, {user?.name || "there"}
            </h1>
            <p className="text-sm text-gray-500">
              {user?.outletName && <>{user.outletName} &middot; </>}{dateStr}
            </p>
          </div>
        </div>

        {/* Checklist priority card */}
        {pendingChecklists.length > 0 && (
          <Link href="/checklists">
            <Card className="border-terracotta bg-terracotta/5 px-4 py-3 ring-1 ring-terracotta/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10">
                    <ClipboardCheck className="h-5 w-5 text-terracotta" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-terracotta-dark">
                      {pendingChecklists.length} checklist{pendingChecklists.length !== 1 ? "s" : ""} pending
                    </p>
                    <p className="text-xs text-terracotta/60">
                      {completedCount}/{totalCount} completed today
                    </p>
                  </div>
                </div>
                <Badge className="bg-terracotta text-[10px]">Do First</Badge>
                <ArrowRight className="h-4 w-4 text-terracotta/50" />
              </div>
            </Card>
          </Link>
        )}

        {/* All done card */}
        {checklists && checklists.length > 0 && pendingChecklists.length === 0 && (
          <Card className="border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700">All checklists done!</p>
                <p className="text-xs text-green-500">{totalCount} completed today</p>
              </div>
            </div>
          </Card>
        )}

        {/* No checklists */}
        {checklists && checklists.length === 0 && (
          <Card className="border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">No checklists assigned today</p>
                <p className="text-xs text-gray-400">Check with your manager</p>
              </div>
            </div>
          </Card>
        )}

        {/* Pending checklist items */}
        {pendingChecklists.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">To Complete</h2>
            <div className="space-y-2">
              {pendingChecklists.map((cl) => {
                const StatusIcon = cl.status === "IN_PROGRESS" ? AlertCircle : Clock;
                const statusColor = cl.status === "IN_PROGRESS" ? "text-blue-500" : "text-yellow-500";
                return (
                  <Link key={cl.id} href={`/checklists/${cl.id}`}>
                    <Card className="px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{cl.sop.title}</p>
                            <p className="text-[10px] text-gray-400">{cl.sop.category.name} · {cl.completedItems}/{cl.totalItems} items</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-gray-600">{cl.progress}%</span>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: "/checklists", icon: ClipboardCheck, label: "Checklists" },
              { href: "/inventory", icon: Package, label: "Stock Count" },
              { href: "/inventory", icon: Trash2, label: "Wastage" },
              { href: "/inventory", icon: ArrowLeftRight, label: "Transfer" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white py-3 text-gray-600 transition-colors hover:bg-terracotta/5 hover:text-terracotta"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
