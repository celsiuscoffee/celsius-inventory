"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ClipboardCheck,
  ShoppingCart,
  Package,
  Trash2,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle2,
  MessageCircle,
  FileText,
} from "lucide-react";

// Time-aware priority actions
const now = new Date();
const hour = now.getHours();

// Mock data
const PENDING_ACTIONS = {
  lowStockCount: 3,
  lowStockItems: ["Fresh Milk", "Smoked Duck", "Oatmilk"],
  deliveriesExpected: 2,
  deliverySuppliers: ["Sri Ternak", "Dankoff"],
  stockCheckDone: false,
  lastCheckTime: "Yesterday, 6:15 PM",
  pendingApproval: 1,
  unreceived: 1,
  pendingInvoices: 2,
};

const WEEKLY = {
  grossSales: 15420.0,
  cogs: 4580.0,
  cogsPercent: 29.7,
  cogsTarget: 28,
  waste: 23.1,
  wastePercent: 0.15,
  transactions: 487,
  ordersPlaced: 8,
  ordersReceived: 6,
};

const RECENT_ORDERS = [
  { id: "CC-IOI-0042", supplier: "Sri Ternak", status: "sent" as const, amount: 180.0, date: "Today" },
  { id: "CC-IOI-0041", supplier: "Dankoff", status: "completed" as const, amount: 312.0, date: "Yesterday" },
  { id: "CC-IOI-0040", supplier: "Unique Paper", status: "completed" as const, amount: 42.0, date: "30 Mar" },
];

const LOW_STOCK = [
  { name: "Fresh Milk", stock: 3, uom: "L", daysLeft: 0.2, parLevel: 20 },
  { name: "Smoked Duck", stock: 0.2, uom: "kg", daysLeft: 0.2, parLevel: 3 },
  { name: "Oatmilk (Oatside)", stock: 3, uom: "btl", daysLeft: 0.75, parLevel: 10 },
  { name: "DVG Blue Ocean Syrup", stock: 0.5, uom: "btl", daysLeft: 1.25, parLevel: 3 },
  { name: "Hot Lid (9oz)", stock: 120, uom: "pcs", daysLeft: 0.6, parLevel: 500 },
];

export default function HomePage() {
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Time-based priority: morning = check stock first, afternoon = order, evening = review
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;

  return (
    <div className="px-4 py-4">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/celsius-logo-sm.jpg"
              alt="Celsius Coffee"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="font-heading text-lg font-bold text-brand-dark">
                {greeting}, Ammar
              </h1>
              <p className="text-sm text-gray-500">
                IOI Conezion &middot; {dateStr}
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            Admin
          </Link>
        </div>

        {/* Priority actions — ordered by time of day */}
        <div className="space-y-2">
          {/* Stock check — highest priority in morning */}
          {!PENDING_ACTIONS.stockCheckDone && (
            <Link href="/check">
              <Card
                className={`px-4 py-3 transition-all ${
                  isMorning
                    ? "border-terracotta bg-terracotta/5 ring-1 ring-terracotta/20"
                    : "border-terracotta/30 bg-terracotta/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10">
                      <ClipboardCheck className="h-5 w-5 text-terracotta" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-terracotta-dark">
                        {isMorning ? "Start daily stock check" : "Daily check not done"}
                      </p>
                      <p className="text-xs text-terracotta/60">
                        Last: {PENDING_ACTIONS.lastCheckTime}
                      </p>
                    </div>
                  </div>
                  {isMorning && (
                    <Badge className="bg-terracotta text-[10px]">Do First</Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-terracotta/50" />
                </div>
              </Card>
            </Link>
          )}

          {/* Low stock — urgent, always visible */}
          {PENDING_ACTIONS.lowStockCount > 0 && (
            <Link href="/order">
              <Card className="border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-700">
                        {PENDING_ACTIONS.lowStockCount} items need ordering
                      </p>
                      <p className="text-xs text-red-400">
                        {PENDING_ACTIONS.lowStockItems.join(", ")}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-red-300" />
                </div>
              </Card>
            </Link>
          )}

          {/* Deliveries expected */}
          {PENDING_ACTIONS.deliveriesExpected > 0 && (
            <Link href="/receive">
              <Card className="border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                      <Package className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-700">
                        {PENDING_ACTIONS.deliveriesExpected} deliveries expected
                      </p>
                      <p className="text-xs text-blue-400">
                        {PENDING_ACTIONS.deliverySuppliers.join(" & ")}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-300" />
                </div>
              </Card>
            </Link>
          )}

          {/* Pending invoices */}
          {PENDING_ACTIONS.pendingInvoices > 0 && (
            <Card className="border-gray-200 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {PENDING_ACTIONS.pendingInvoices} invoices pending
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Admin
                </Badge>
              </div>
            </Card>
          )}
        </div>

        {/* Weekly performance */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            This Week
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <Card className="px-3 py-2.5">
              <p className="text-[10px] text-gray-400">Gross Sales</p>
              <p className="text-base font-bold text-gray-900">
                RM {(WEEKLY.grossSales / 1000).toFixed(1)}k
              </p>
            </Card>
            <Card className="px-3 py-2.5">
              <p className="text-[10px] text-gray-400">COGS</p>
              <p
                className={`text-base font-bold ${WEEKLY.cogsPercent > WEEKLY.cogsTarget ? "text-red-600" : "text-green-600"}`}
              >
                {WEEKLY.cogsPercent}%
              </p>
              <p className="text-[10px] text-gray-400">
                target {WEEKLY.cogsTarget}%
              </p>
            </Card>
            <Card className="px-3 py-2.5">
              <p className="text-[10px] text-gray-400">Waste</p>
              <p className="text-base font-bold text-gray-900">
                RM {WEEKLY.waste.toFixed(0)}
              </p>
              <p className="text-[10px] text-gray-400">
                {WEEKLY.wastePercent}%
              </p>
            </Card>
          </div>
        </div>

        {/* Stock alerts — compact list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Stock Levels
            </h2>
            <Link href="/order" className="text-xs text-terracotta">
              Order all →
            </Link>
          </div>
          <Card className="divide-y divide-gray-50 overflow-hidden">
            {LOW_STOCK.map((item) => {
              const stockPercent = (item.stock / item.parLevel) * 100;
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-900">
                      {item.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${stockPercent < 20 ? "bg-red-500" : stockPercent < 50 ? "bg-terracotta" : "bg-green-500"}`}
                          style={{
                            width: `${Math.min(stockPercent, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {item.stock}/{item.parLevel} {item.uom}
                      </span>
                    </div>
                  </div>
                  <Badge
                    className={`shrink-0 text-[10px] ${item.daysLeft < 1 ? "bg-red-500" : "bg-terracotta"}`}
                  >
                    {item.daysLeft < 1
                      ? "< 1d"
                      : `${item.daysLeft.toFixed(1)}d`}
                  </Badge>
                </div>
              );
            })}
          </Card>
        </div>

        {/* Recent orders */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Recent Orders
          </h2>
          <Card className="divide-y divide-gray-50 overflow-hidden">
            {RECENT_ORDERS.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div>
                  <p className="text-sm text-gray-900">{order.supplier}</p>
                  <p className="text-[10px] text-gray-400">
                    {order.id} &middot; {order.date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    RM {order.amount.toFixed(0)}
                  </span>
                  {order.status === "sent" ? (
                    <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-gray-300" />
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Quick actions — bottom grid */}
        <div className="grid grid-cols-4 gap-2 pb-4">
          {[
            { href: "/check", icon: ClipboardCheck, label: "Check" },
            { href: "/order", icon: ShoppingCart, label: "Order" },
            { href: "/receive", icon: Package, label: "Receive" },
            { href: "/wastage", icon: Trash2, label: "Wastage" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
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
  );
}
