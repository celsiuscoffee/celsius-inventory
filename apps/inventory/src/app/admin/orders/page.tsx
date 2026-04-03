"use client";

import { useState, useEffect, Fragment, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ChevronDown,
  ShoppingCart,
  MessageCircle,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  Send,
  Ban,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  product: string;
  sku: string;
  uom: string;
  package: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  branch: string;
  branchCode: string;
  supplierId: string;
  supplier: string;
  supplierPhone: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  deliveryDate: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  items: OrderItem[];
  receivingCount: number;
};

type SupplierProduct = {
  id: string;
  name: string;
  sku: string;
  packageId: string | null;
  packageLabel: string;
  price: number;
  conversionFactor: number;
};

type SupplierOption = {
  id: string;
  name: string;
  phone: string;
  products: SupplierProduct[];
};

type BranchOption = {
  id: string;
  code: string;
  name: string;
};

type StockLevelItem = {
  productId: string;
  name: string;
  sku: string;
  category: string;
  baseUom: string;
  currentQty: number;
  parLevel: number;
  reorderPoint: number;
  avgDailyUsage: number;
  daysLeft: number | null;
  suggestedOrderQty: number;
  status: "critical" | "low" | "ok" | "overstocked" | "no_par";
};

type CartItem = {
  productId: string;
  productPackageId: string | null;
  name: string;
  sku: string;
  supplier: string;
  supplierId: string;
  supplierPhone: string;
  packageLabel: string;
  quantity: number;
  unitPrice: number;
};

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", color: "bg-gray-400", icon: FileText },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-amber-500", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-blue-500", icon: CheckCircle2 },
  SENT: { label: "Sent", color: "bg-green-500", icon: MessageCircle },
  AWAITING_DELIVERY: { label: "Awaiting Delivery", color: "bg-purple-500", icon: Truck },
  PARTIALLY_RECEIVED: { label: "Partially Received", color: "bg-amber-600", icon: AlertTriangle },
  COMPLETED: { label: "Completed", color: "bg-gray-500", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-red-500", icon: AlertTriangle },
};

const NEXT_ACTIONS: Record<string, { status: string; label: string; icon: typeof Clock; color: string }[]> = {
  DRAFT: [
    { status: "PENDING_APPROVAL", label: "Submit for Approval", icon: Send, color: "bg-amber-500 hover:bg-amber-600" },
    { status: "CANCELLED", label: "Cancel", icon: Ban, color: "bg-red-500 hover:bg-red-600" },
  ],
  PENDING_APPROVAL: [
    { status: "APPROVED", label: "Approve", icon: ThumbsUp, color: "bg-blue-500 hover:bg-blue-600" },
    { status: "CANCELLED", label: "Reject", icon: Ban, color: "bg-red-500 hover:bg-red-600" },
  ],
  APPROVED: [
    { status: "SENT", label: "Mark as Sent", icon: Send, color: "bg-green-500 hover:bg-green-600" },
  ],
  SENT: [
    { status: "AWAITING_DELIVERY", label: "Awaiting Delivery", icon: Truck, color: "bg-purple-500 hover:bg-purple-600" },
  ],
  AWAITING_DELIVERY: [],
  PARTIALLY_RECEIVED: [],
  COMPLETED: [],
  CANCELLED: [],
};

// ── Component ─────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Table state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create order state
  const [showCreate, setShowCreate] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [stockLevels, setStockLevels] = useState<StockLevelItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [createTab, setCreateTab] = useState<"suggested" | "all" | "reorder">("suggested");
  const [showAllNeeds, setShowAllNeeds] = useState(false);

  // WhatsApp dialog
  const [whatsappDialog, setWhatsappDialog] = useState<{
    open: boolean;
    supplier: string;
    supplierId: string;
    message: string;
    phone: string;
    items: CartItem[];
  }>({ open: false, supplier: "", supplierId: "", message: "", phone: "", items: [] });
  const [sending, setSending] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────

  const loadOrders = useCallback(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const loadStockLevels = useCallback(async (branchId: string) => {
    if (!branchId) { setStockLevels([]); return; }
    setLoadingStock(true);
    try {
      const res = await fetch(`/api/stock-levels?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setStockLevels(data.items || []);
      }
    } catch { /* silently fail */ }
    finally { setLoadingStock(false); }
  }, []);

  // ── Create order helpers ────────────────────────────────────────────────

  const openCreateDialog = async () => {
    const [s, b] = await Promise.all([
      fetch("/api/suppliers/products").then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]);
    setSuppliers(s);
    setBranches(b);
    const defaultBranch = b[0]?.id ?? "";
    setSelectedBranchId(defaultBranch);
    setCart([]);
    setOrderNotes("");
    setDeliveryDate("");
    setProductSearch("");
    setCreateTab("suggested");
    setShowCreate(true);
    if (defaultBranch) loadStockLevels(defaultBranch);
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setCart([]); // clear cart when branch changes
    loadStockLevels(branchId);
  };

  // Needs ordering: critical/low items matched with supplier info
  const needsOrdering = stockLevels
    .filter((i) =>
      (i.status === "critical" || i.status === "low") &&
      (!productSearch ||
        i.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        i.sku.toLowerCase().includes(productSearch.toLowerCase()))
    )
    .map((item) => {
      let supplierMatch: SupplierOption | undefined;
      let productMatch: SupplierProduct | undefined;
      for (const s of suppliers) {
        const p = s.products.find((sp) => sp.id === item.productId);
        if (p) { supplierMatch = s; productMatch = p; break; }
      }
      return { ...item, supplier: supplierMatch, supplierProduct: productMatch };
    })
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  // All products grouped by supplier — only show when searching (don't render 1000 products)
  const supplierProducts = productSearch.trim().length >= 2
    ? suppliers
        .filter((s) => s.products.length > 0)
        .map((s) => ({
          ...s,
          products: s.products.filter((p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
          ),
        }))
        .filter((s) => s.products.length > 0)
    : [];

  // Quick reorder: last order per supplier for the selected branch
  const quickReorders = (() => {
    const branch = branches.find((b) => b.id === selectedBranchId);
    if (!branch) return [];
    const branchOrders = orders.filter((o) => o.branch === branch.name);
    const seen = new Set<string>();
    const result: Order[] = [];
    for (const order of branchOrders) {
      if (!seen.has(order.supplier) && order.items.length > 0) {
        seen.add(order.supplier);
        result.push(order);
      }
    }
    return result;
  })();

  // Cart helpers
  const isInCart = (productId: string, supplierId: string) =>
    cart.some((c) => c.productId === productId && c.supplierId === supplierId);

  const addToCart = (item: CartItem) => {
    if (isInCart(item.productId, item.supplierId)) return;
    setCart((prev) => [...prev, item]);
  };

  const updateCartQty = (productId: string, supplierId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId && c.supplierId === supplierId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: string, supplierId: string) => {
    setCart((prev) => prev.filter((c) => !(c.productId === productId && c.supplierId === supplierId)));
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  // Group cart by supplier
  const cartBySupplier = cart.reduce(
    (acc, item) => {
      if (!acc[item.supplier])
        acc[item.supplier] = { items: [], phone: item.supplierPhone, supplierId: item.supplierId };
      acc[item.supplier].items.push(item);
      return acc;
    },
    {} as Record<string, { items: CartItem[]; phone: string; supplierId: string }>
  );

  // Handle quick reorder
  const handleReorder = (order: Order) => {
    const supplier = suppliers.find((s) => s.name === order.supplier);
    if (!supplier) return;
    const newItems: CartItem[] = order.items
      .map((item) => {
        const sp = supplier.products.find((p) => p.name === item.product || p.sku === item.sku);
        if (!sp) return null;
        return {
          productId: sp.id,
          productPackageId: sp.packageId,
          name: item.product,
          sku: item.sku,
          supplier: order.supplier,
          supplierId: supplier.id,
          supplierPhone: order.supplierPhone,
          packageLabel: sp.packageLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
      })
      .filter((x): x is CartItem => x !== null);
    setCart((prev) => {
      const existing = new Set(prev.map((c) => `${c.productId}-${c.supplierId}`));
      return [...prev, ...newItems.filter((n) => !existing.has(`${n.productId}-${n.supplierId}`))];
    });
  };

  // ── WhatsApp flow ───────────────────────────────────────────────────────

  const sendViaWhatsApp = (supplier: string) => {
    const group = cartBySupplier[supplier];
    if (!group) return;
    const branch = branches.find((b) => b.id === selectedBranchId);
    const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
    let message = `📋 *Order from Celsius Coffee*\n`;
    message += `Branch: ${branch?.name || "—"}\nDate: ${today}\n\n`;
    group.items.forEach((item, i) => {
      message += `${i + 1}. ${item.name} — ${item.quantity} ${item.packageLabel}\n`;
    });
    message += `\nDelivery: ${deliveryDate || tomorrow}`;
    if (orderNotes) message += `\nNotes: ${orderNotes}`;
    message += `\n\nThank you! 🙏`;
    setWhatsappDialog({ open: true, supplier, supplierId: group.supplierId, message, phone: group.phone, items: group.items });
  };

  const openWhatsApp = async () => {
    setSending(true);
    try {
      const group = cartBySupplier[whatsappDialog.supplier];
      if (!group) return;
      const delDate = deliveryDate || new Date(Date.now() + 86400000).toISOString().split("T")[0];

      // Create order via API
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          supplierId: whatsappDialog.supplierId,
          items: group.items.map((item) => ({
            productId: item.productId,
            productPackageId: item.productPackageId || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: orderNotes || null,
          deliveryDate: delDate,
        }),
      });

      if (orderRes.ok) {
        const order = await orderRes.json();
        // Mark as SENT
        await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SENT" }),
        });
      }

      // Open WhatsApp
      const phone = whatsappDialog.phone.replace(/\+/g, "");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsappDialog.message)}`, "_blank");

      // Remove sent items from cart
      setCart((prev) => prev.filter((c) => c.supplierId !== whatsappDialog.supplierId));
      setWhatsappDialog({ open: false, supplier: "", supplierId: "", message: "", phone: "", items: [] });
      loadOrders();
    } catch (err) {
      console.error("Failed to create order:", err);
    } finally {
      setSending(false);
    }
  };

  const submitAsDraft = async () => {
    // Submit all cart items grouped by supplier as separate draft orders
    setSaving(true);
    try {
      for (const [, group] of Object.entries(cartBySupplier)) {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: selectedBranchId,
            supplierId: group.supplierId,
            notes: orderNotes || null,
            deliveryDate: deliveryDate || null,
            items: group.items.map((c) => ({
              productId: c.productId,
              productPackageId: c.productPackageId,
              quantity: c.quantity,
              unitPrice: c.unitPrice,
            })),
          }),
        });
      }
      setShowCreate(false);
      setCart([]);
      loadOrders();
    } finally {
      setSaving(false);
    }
  };

  // ── Status update ───────────────────────────────────────────────────────

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  const buildWhatsAppUrl = (order: Order) => {
    const items = order.items.map((i) => `• ${i.product} (${i.uom || i.package}) × ${i.quantity}`).join("\n");
    const msg = `Hi, this is Celsius Coffee.\n\nPO: ${order.orderNumber}\nBranch: ${order.branch}\n${order.deliveryDate ? `Delivery: ${order.deliveryDate}\n` : ""}\nOrder:\n${items}\n\nTotal: RM ${order.totalAmount.toFixed(2)}\n\n${order.notes ? `Notes: ${order.notes}\n\n` : ""}Thank you!`;
    const phone = order.supplierPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  // ── Filters ─────────────────────────────────────────────────────────────

  const statuses = ["All", ...Object.keys(STATUS_CONFIG)];
  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.toLowerCase().includes(search.toLowerCase()) ||
      o.branch.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalValue = filtered.reduce((a, o) => a + o.totalAmount, 0);
  const pendingCount = orders.filter((o) => ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "AWAITING_DELIVERY"].includes(o.status)).length;

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Purchase Orders</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {orders.length} orders &middot; {pendingCount} active
          </p>
        </div>
        <Button className="bg-terracotta hover:bg-terracotta-dark" onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />Create Order
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-4 gap-4">
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Total Orders</p>
          <p className="text-xl font-bold text-gray-900">{orders.length}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Active / In Progress</p>
          <p className="text-xl font-bold text-terracotta">{pendingCount}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-xl font-bold text-green-600">{orders.filter((o) => o.status === "COMPLETED").length}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs text-gray-500">Total Value</p>
          <p className="text-xl font-bold text-gray-900">RM {totalValue.toFixed(2)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by PO#, supplier, or branch..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => {
            const config = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusFilter === s ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              >
                {s === "All" ? "All" : config?.label ?? s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="w-8 px-3 py-3"></th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">PO Number</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Supplier</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Items</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Delivery</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <ShoppingCart className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    {orders.length === 0 ? "No orders yet. Click 'Create Order' to get started." : "No orders match your filter."}
                  </p>
                </td>
              </tr>
            )}
            {filtered.map((order) => {
              const config = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-gray-400", icon: Clock };
              const actions = NEXT_ACTIONS[order.status] ?? [];
              return (
                <Fragment key={order.id}>
                  <tr className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                    <td className="px-3 py-3">
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} />
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-terracotta">{order.orderNumber}</code>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{order.branch}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.supplier}</span>
                        {order.supplierPhone && (
                          <a href={buildWhatsAppUrl(order)} target="_blank" onClick={(e) => e.stopPropagation()} className="text-green-600 hover:text-green-700" title="Send via WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">RM {order.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="flex items-center gap-1 text-xs"><Package className="h-3 w-3" />{order.items.length}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{order.deliveryDate ?? "—"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {actions.map((a) => (
                          <button key={a.status} onClick={() => updateStatus(order.id, a.status)} disabled={updatingId === order.id} className={`rounded-md px-2 py-1 text-[10px] font-medium text-white ${a.color} disabled:opacity-50`} title={a.label}>
                            {updatingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : a.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-8 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase">Order Items</p>
                          <div className="flex gap-2 text-xs text-gray-400">
                            <span>Created by: {order.createdBy}</span>
                            {order.approvedBy && <span>&middot; Approved by: {order.approvedBy}</span>}
                            {order.sentAt && <span>&middot; Sent: {new Date(order.sentAt).toLocaleDateString("en-MY")}</span>}
                          </div>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="pb-1 text-left font-medium">Product</th>
                              <th className="pb-1 text-left font-medium">SKU</th>
                              <th className="pb-1 text-left font-medium">Package</th>
                              <th className="pb-1 text-right font-medium">Qty</th>
                              <th className="pb-1 text-right font-medium">Unit Price</th>
                              <th className="pb-1 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item) => (
                              <tr key={item.id} className="border-t border-gray-200/50">
                                <td className="py-1.5 text-gray-700">{item.product}</td>
                                <td className="py-1.5"><code className="text-gray-500">{item.sku}</code></td>
                                <td className="py-1.5 text-gray-500">{item.uom || item.package}</td>
                                <td className="py-1.5 text-right text-gray-700">{item.quantity}</td>
                                <td className="py-1.5 text-right text-gray-600">RM {item.unitPrice.toFixed(2)}</td>
                                <td className="py-1.5 text-right text-gray-900 font-medium">RM {item.totalPrice.toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-gray-300">
                              <td colSpan={5} className="py-1.5 font-semibold text-gray-700">Total</td>
                              <td className="py-1.5 text-right font-semibold text-gray-900">RM {order.totalAmount.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {order.notes && <p className="mt-2 text-xs text-gray-500">Notes: {order.notes}</p>}
                        {order.receivingCount > 0 && <p className="mt-2 text-xs text-green-600">{order.receivingCount} receiving record(s) linked</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Create Order Dialog (Smart Ordering) ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Smart Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Branch selector + delivery + notes */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Delivery Date</label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                <Input placeholder="Optional notes..." value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-2">
              <div className="flex gap-1">
                {([
                  { id: "suggested" as const, label: "Needs Ordering", icon: AlertTriangle, count: needsOrdering.length },
                  { id: "all" as const, label: "All Products", icon: Package, count: 0 },
                  { id: "reorder" as const, label: "Quick Reorder", icon: RotateCcw, count: quickReorders.length },
                ]).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setCreateTab(tab.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        createTab === tab.id ? "bg-terracotta text-white" : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`ml-0.5 rounded-full px-1.5 text-[10px] ${createTab === tab.id ? "bg-white/20" : "bg-red-100 text-red-600"}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="relative ml-auto flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Search..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-8 pl-8 text-xs" />
              </div>
            </div>

            {/* Loading stock */}
            {loadingStock && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
                <span className="ml-2 text-xs text-gray-500">Loading stock levels...</span>
              </div>
            )}

            {/* ── Needs Ordering tab ── */}
            {createTab === "suggested" && !loadingStock && (
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {needsOrdering.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">All stock levels are healthy for this branch</p>
                ) : (
                  (showAllNeeds ? needsOrdering : needsOrdering.slice(0, 10)).map((item) => {
                    const pct = item.parLevel > 0 ? Math.min(100, Math.round((item.currentQty / item.parLevel) * 100)) : 0;
                    const barColor = item.status === "critical" ? "bg-red-500" : "bg-amber-500";
                    const inCartAlready = item.supplier && isInCart(item.productId, item.supplier.id);
                    const cartItem = item.supplier ? cart.find((c) => c.productId === item.productId && c.supplierId === item.supplier!.id) : null;
                    const pkgQty = item.supplierProduct ? Math.max(1, Math.ceil((item.suggestedOrderQty || 1) / (item.supplierProduct.conversionFactor || 1))) : 1;

                    return (
                      <div key={item.productId} className={`rounded-lg border px-3 py-2 ${item.status === "critical" ? "border-red-200 bg-red-50/30" : "border-amber-200 bg-amber-50/30"}`}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-[11px] text-gray-500">
                              {item.sku}
                              {item.supplier && item.supplierProduct && (
                                <> &middot; {item.supplier.name} &middot; RM {item.supplierProduct.price.toFixed(2)}/{item.supplierProduct.packageLabel}</>
                              )}
                            </p>
                          </div>
                          <Badge className={`ml-2 text-[10px] ${(item.daysLeft ?? 0) < 0.1 ? "bg-red-600" : (item.daysLeft ?? 0) < 1 ? "bg-red-500" : "bg-amber-500"}`}>
                            {(item.daysLeft ?? 0) < 0.1 ? "OUT" : `${(item.daysLeft ?? 0).toFixed(1)}d left`}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="whitespace-nowrap text-[10px] text-gray-400">
                            {item.currentQty.toLocaleString()}/{item.parLevel.toLocaleString()} {item.baseUom}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-end">
                          {inCartAlready && cartItem ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateCartQty(item.productId, item.supplier!.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600"><Minus className="h-3 w-3" /></button>
                              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{cartItem.quantity}</span>
                              <button onClick={() => updateCartQty(item.productId, item.supplier!.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-terracotta/10 text-terracotta-dark"><Plus className="h-3 w-3" /></button>
                            </div>
                          ) : item.supplier && item.supplierProduct ? (
                            <Button size="sm" className={`h-6 text-[11px] ${item.status === "critical" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
                              onClick={() => addToCart({
                                productId: item.productId, productPackageId: item.supplierProduct!.packageId,
                                name: item.name, sku: item.sku, supplier: item.supplier!.name,
                                supplierId: item.supplier!.id, supplierPhone: item.supplier!.phone,
                                packageLabel: item.supplierProduct!.packageLabel,
                                quantity: pkgQty, unitPrice: item.supplierProduct!.price,
                              })}
                            >
                              <Plus className="mr-0.5 h-3 w-3" />Add {pkgQty} {item.supplierProduct.packageLabel}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-gray-400">No supplier linked</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {!showAllNeeds && needsOrdering.length > 10 && (
                  <button
                    onClick={() => setShowAllNeeds(true)}
                    className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Show {needsOrdering.length - 10} more items
                  </button>
                )}
              </div>
            )}

            {/* ── All Products tab ── */}
            {createTab === "all" && !loadingStock && (
              <div className="max-h-72 overflow-y-auto space-y-3">
                {supplierProducts.length === 0 ? (
                  <div className="py-6 text-center">
                    <Search className="mx-auto h-6 w-6 text-gray-300" />
                    <p className="mt-2 text-xs text-gray-400">
                      {productSearch && productSearch.trim().length >= 2
                        ? "No products match your search"
                        : "Type at least 2 characters to search products"}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-300">
                      {!productSearch || productSearch.trim().length < 2
                        ? `${suppliers.reduce((acc, s) => acc + s.products.length, 0)} products from ${suppliers.length} suppliers available`
                        : "Try a different keyword or SKU"}
                    </p>
                  </div>
                ) : (
                  supplierProducts.map((supplier) => (
                    <div key={supplier.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-gray-700">{supplier.name}</h3>
                        <Badge className="bg-terracotta/10 text-[10px] text-terracotta-dark">{supplier.products.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {supplier.products.map((product) => {
                          const inCart = isInCart(product.id, supplier.id);
                          const cartItem = cart.find((c) => c.productId === product.id && c.supplierId === supplier.id);
                          return (
                            <div key={`${supplier.id}-${product.id}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                <p className="text-[11px] text-gray-500">{product.sku} &middot; {product.packageLabel} &middot; RM {product.price.toFixed(2)}</p>
                              </div>
                              {inCart ? (
                                <div className="flex items-center gap-2">
                                  <button onClick={() => updateCartQty(product.id, supplier.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600"><Minus className="h-3 w-3" /></button>
                                  <span className="min-w-[1.5rem] text-center text-sm font-semibold">{cartItem?.quantity}</span>
                                  <button onClick={() => updateCartQty(product.id, supplier.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-terracotta/10 text-terracotta-dark"><Plus className="h-3 w-3" /></button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 text-[11px]"
                                  onClick={() => addToCart({
                                    productId: product.id, productPackageId: product.packageId,
                                    name: product.name, sku: product.sku, supplier: supplier.name,
                                    supplierId: supplier.id, supplierPhone: supplier.phone,
                                    packageLabel: product.packageLabel, quantity: 1, unitPrice: product.price,
                                  })}
                                >
                                  <Plus className="mr-0.5 h-3 w-3" />Add
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Quick Reorder tab ── */}
            {createTab === "reorder" && (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {quickReorders.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">No previous orders for this branch</p>
                ) : (
                  quickReorders.map((order) => (
                    <div key={order.id} className="rounded-lg border border-gray-100 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{order.supplier}</p>
                          <p className="text-[11px] text-gray-400">
                            {order.orderNumber} &middot; {new Date(order.createdAt).toLocaleDateString("en-MY")} &middot; RM {order.totalAmount.toFixed(2)}
                          </p>
                        </div>
                        <Button size="sm" className="h-7 bg-green-600 text-xs hover:bg-green-700" onClick={() => handleReorder(order)}>
                          <RotateCcw className="mr-1 h-3 w-3" />Reorder
                        </Button>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {order.items.map((item, i) => (
                          <p key={i} className="text-[11px] text-gray-500">{item.quantity} {item.uom || item.package} — {item.product}</p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Cart summary ── */}
            {cart.length > 0 && (
              <div className="rounded-lg border border-terracotta/20 bg-terracotta/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <ShoppingCart className="h-4 w-4" />{cart.length} items in cart
                  </span>
                  <span className="text-sm font-bold text-gray-900">RM {cartTotal.toFixed(2)}</span>
                </div>

                {/* Items grouped by supplier */}
                {Object.entries(cartBySupplier).map(([supplier, group]) => (
                  <div key={supplier} className="mb-2">
                    <p className="mb-1 text-[11px] font-semibold text-gray-600">{supplier}</p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <div key={`${item.productId}-${item.supplierId}`} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{item.quantity} × RM {item.unitPrice.toFixed(2)}</span>
                            <span className="font-medium">RM {(item.quantity * item.unitPrice).toFixed(2)}</span>
                            <button onClick={() => removeFromCart(item.productId, item.supplierId)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Action buttons */}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-xs" onClick={submitAsDraft} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileText className="mr-1 h-3 w-3" />}
                    Save as Draft
                  </Button>
                  {Object.entries(cartBySupplier).map(([supplier, group]) => (
                    <Button key={supplier} className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-xs" onClick={() => sendViaWhatsApp(supplier)}>
                      <MessageCircle className="mr-1 h-3 w-3" />
                      Send to {supplier} ({group.items.length})
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp preview dialog */}
      <Dialog open={whatsappDialog.open} onOpenChange={(open) => setWhatsappDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Order to {whatsappDialog.supplier}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-green-50 p-3">
              <pre className="whitespace-pre-wrap text-xs text-gray-700">{whatsappDialog.message}</pre>
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={openWhatsApp} disabled={sending}>
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-1.5 h-4 w-4" />}
              {sending ? "Creating order..." : "Open WhatsApp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
