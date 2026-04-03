"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/top-bar";
import { Card } from "@/components/ui/card";
import {
  FileBarChart,
  Settings,
  LogOut,
  ChevronRight,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Shield,
  Loader2,
} from "lucide-react";

type User = {
  id: string;
  name: string;
  role: string;
  branchId: string | null;
};

type QuickStat = {
  label: string;
  value: string;
  target: string;
  status: "over" | "ok" | "warn";
  icon: typeof DollarSign;
};

const MENU_ITEMS = [
  { label: "Reports", icon: FileBarChart, href: "/admin/reports" },
  { label: "Settings", icon: Settings, href: "/admin" },
];

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setUser(data);
          fetchStats(data.branchId);
        }
      })
      .catch(() => {});
  }, []);

  const fetchStats = async (branchId: string | null) => {
    try {
      const [dashRes, stockRes] = await Promise.all([
        fetch("/api/dashboard"),
        branchId ? fetch(`/api/stock-levels?branchId=${branchId}`) : Promise.resolve(null),
      ]);
      const dash = dashRes.ok ? await dashRes.json() : null;
      const stock = stockRes && stockRes.ok ? await stockRes.json() : null;

      const stats: QuickStat[] = [];
      if (dash) {
        stats.push({
          label: "Spending This Week",
          value: `RM ${Number(dash.weeklySpending || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
          target: `${dash.ordersPlaced || 0} orders placed`,
          status: Number(dash.weeklySpending || 0) > 5000 ? "over" : "ok",
          icon: DollarSign,
        });
        stats.push({
          label: "Waste This Week",
          value: `RM ${Number(dash.wasteTotal || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
          target: `${dash.receivingsThisWeek || 0} receivings`,
          status: Number(dash.wasteTotal || 0) > 100 ? "over" : "ok",
          icon: TrendingDown,
        });
      }
      if (stock?.summary) {
        const lowCount = (stock.summary.critical || 0) + (stock.summary.low || 0);
        stats.push({
          label: "Low Stock Items",
          value: String(lowCount),
          target: "Below reorder point",
          status: lowCount > 10 ? "over" : lowCount > 0 ? "warn" : "ok",
          icon: AlertTriangle,
        });
      }
      setQuickStats(stats);
    } catch {
      // silently fail — stats are non-critical
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "?";
  const roleLabel = user?.role === "ADMIN" ? "Admin" : user?.role === "BRANCH_MANAGER" ? "Branch Manager" : "Staff";

  return (
    <>
      <TopBar title="Profile" />

      <div className="px-4 py-3">
        <div className="mx-auto max-w-lg space-y-4">
          {/* User info */}
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-lg font-bold text-terracotta-dark">
                {initial}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{user?.name ?? "Loading..."}</p>
                <p className="text-sm text-gray-500">{roleLabel}</p>
              </div>
              {(user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER") && (
                <a href="/admin" className="flex items-center gap-1 rounded-lg bg-terracotta/10 px-2.5 py-1.5 text-xs font-medium text-terracotta-dark">
                  <Shield className="h-3 w-3" />
                  {user?.role === "ADMIN" ? "Admin" : "Manager"}
                </a>
              )}
            </div>
          </Card>

          {/* Quick stats */}
          {quickStats.length > 0 && <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">This Week</h2>
            <div className="space-y-1.5">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          stat.status === "over"
                            ? "bg-red-100 text-red-600"
                            : stat.status === "warn"
                              ? "bg-terracotta/10 text-terracotta"
                              : "bg-green-100 text-green-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-sm font-semibold text-gray-900">{stat.value}</p>
                      </div>
                      <p className="text-xs text-gray-400">{stat.target}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>}

          {/* Menu */}
          {(user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER") && (
            <div className="space-y-1">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100"
                  >
                    <Icon className="h-5 w-5 text-gray-400" />
                    <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            {loggingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
