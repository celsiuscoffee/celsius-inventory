"use client";

import Link from "next/link";
import { Package, Truck, Tags, Building2, ShoppingCart, ArrowRightLeft, FileText, Users, TrendingUp, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFetch } from "@/lib/use-fetch";

type Stats = {
  products: number;
  suppliers: number;
  categories: number;
  branches: number;
  staff: number;
  menus: number;
  invoices: { total: number; pendingAmount: number; overdueAmount: number };
};

type Dashboard = {
  ordersPlaced: number;
  pendingApprovals: number;
  deliveriesExpected: number;
  deliverySuppliers: string[];
  weeklySpending: number;
  wasteTotal: number;
  receivingsThisWeek: number;
  stockCheckDone: boolean;
  lastCheckTime: string | null;
  recentOrders: { id: string; orderNumber: string; supplier: string; status: string; totalAmount: number; createdAt: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-400",
  PENDING_APPROVAL: "bg-amber-500",
  APPROVED: "bg-blue-500",
  SENT: "bg-green-500",
  AWAITING_DELIVERY: "bg-purple-500",
  PARTIALLY_RECEIVED: "bg-amber-600",
  COMPLETED: "bg-gray-500",
  CANCELLED: "bg-red-500",
};

export default function AdminDashboard() {
  // 2 lightweight API calls instead of 8 full-data fetches
  const { data: stats, isLoading: loadingStats, error: statsError } = useFetch<Stats>("/api/admin/stats");
  const { data: dashboard, isLoading: loadingDash, error: dashError } = useFetch<Dashboard>("/api/dashboard");

  const loading = loadingStats || loadingDash;
  const error = statsError || dashError;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      </div>
    );
  }

  if (error || !stats || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="mt-2 text-sm text-gray-600">Failed to load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm text-terracotta hover:underline">Refresh page</button>
      </div>
    );
  }

  const data = {
    ...stats,
    orders: {
      total: dashboard.ordersPlaced,
      active: dashboard.pendingApprovals + dashboard.deliveriesExpected,
      recent: dashboard.recentOrders || [],
    },
    receivings: {
      total: dashboard.receivingsThisWeek,
      recentCount: dashboard.receivingsThisWeek,
    },
  };

  const stats = [
    { label: "Products", value: data.products, icon: Package, href: "/admin/products", color: "bg-blue-50 text-blue-600" },
    { label: "Suppliers", value: data.suppliers, icon: Truck, href: "/admin/suppliers", color: "bg-green-50 text-green-600" },
    { label: "Categories", value: data.categories, icon: Tags, href: "/admin/categories", color: "bg-purple-50 text-purple-600" },
    { label: "Branches", value: data.branches, icon: Building2, href: "/admin/branches", color: "bg-amber-50 text-amber-600" },
    { label: "Staff", value: data.staff, icon: Users, href: "/admin/staff", color: "bg-pink-50 text-pink-600" },
    { label: "Menu Items", value: data.menus, icon: TrendingUp, href: "/admin/menus", color: "bg-teal-50 text-teal-600" },
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">Overview of your inventory system</p>

      {/* Master data stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className={`inline-flex rounded-lg p-2 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Ordering overview */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Link href="/admin/orders" className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-terracotta/10 p-2">
              <ShoppingCart className="h-5 w-5 text-terracotta" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.orders.total}</p>
              <p className="text-sm text-gray-500">Purchase Orders</p>
            </div>
          </div>
          {data.orders.active > 0 && (
            <p className="mt-2 text-xs text-terracotta font-medium">{data.orders.active} active</p>
          )}
        </Link>

        <Link href="/admin/receivings" className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.receivings.total}</p>
              <p className="text-sm text-gray-500">Receivings</p>
            </div>
          </div>
          {data.receivings.recentCount > 0 && (
            <p className="mt-2 text-xs text-blue-600 font-medium">{data.receivings.recentCount} this week</p>
          )}
        </Link>

        <Link href="/admin/invoices" className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.invoices.total}</p>
              <p className="text-sm text-gray-500">Invoices</p>
            </div>
          </div>
          <div className="mt-2 flex gap-3">
            {data.invoices.pendingAmount > 0 && (
              <p className="text-xs text-terracotta font-medium">RM {data.invoices.pendingAmount.toFixed(0)} pending</p>
            )}
            {data.invoices.overdueAmount > 0 && (
              <p className="text-xs text-red-600 font-medium">RM {data.invoices.overdueAmount.toFixed(0)} overdue</p>
            )}
          </div>
        </Link>
      </div>

      {/* Recent orders */}
      {data.orders.recent.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
            <Link href="/admin/orders" className="text-xs text-terracotta hover:underline">View all</Link>
          </div>
          <div className="mt-2 rounded-xl border border-gray-200 bg-white">
            {data.orders.recent.map((order, idx) => (
              <div key={idx} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-gray-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-terracotta">{order.orderNumber}</code>
                  <span className="text-sm text-gray-700">{order.supplier}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">RM {order.totalAmount.toFixed(2)}</span>
                  <Badge className={`text-[10px] ${STATUS_COLORS[order.status] ?? "bg-gray-400"}`}>
                    {order.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
