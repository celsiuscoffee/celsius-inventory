"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ShoppingCart,
  Plus,
  Minus,
  Search,
  MessageCircle,
  TrendingDown,
  Clock,
  CheckCircle2,
  History,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

// Mock data matching FMH supplier-product-price structure
const ORDER_SUGGESTIONS = {
  urgent: [
    {
      id: "1",
      name: "Fresh Milk",
      sku: "DFM001",
      currentStock: 3,
      parLevel: 20,
      avgDailyUsage: 15,
      daysLeft: 0.2,
      supplier: "Sri Ternak",
      supplierPhone: "+60123456789",
      suggestedQty: 17,
      uom: "L",
      unitPrice: 5.0,
      packageOptions: [
        { label: "Liter", value: "L", price: 5.0 },
        { label: "Carton (6L)", value: "CTN", price: 28.0 },
      ],
    },
    {
      id: "2",
      name: "Smoked Duck",
      sku: "M0006",
      currentStock: 0.2,
      parLevel: 3,
      avgDailyUsage: 1,
      daysLeft: 0.2,
      supplier: "365EAT FOOD",
      supplierPhone: "+60198765432",
      suggestedQty: 3,
      uom: "kg",
      unitPrice: 45.0,
      packageOptions: [{ label: "Kilogram", value: "kg", price: 45.0 }],
    },
  ],
  restockSoon: [
    {
      id: "3",
      name: "Oatmilk (Oatside)",
      sku: "DO001",
      currentStock: 3,
      parLevel: 10,
      avgDailyUsage: 4,
      daysLeft: 0.75,
      supplier: "Dankoff",
      supplierPhone: "+60112233445",
      suggestedQty: 7,
      uom: "btl",
      unitPrice: 52.0,
      packageOptions: [
        { label: "Bottle (1000ml)", value: "btl", price: 52.0 },
        { label: "Carton (6 btl)", value: "CTN", price: 290.0 },
      ],
    },
    {
      id: "4",
      name: "DVG Blue Ocean Syrup",
      sku: "FD003",
      currentStock: 0.5,
      parLevel: 3,
      avgDailyUsage: 0.4,
      daysLeft: 1.25,
      supplier: "Dankoff",
      supplierPhone: "+60112233445",
      suggestedQty: 2,
      uom: "btl",
      unitPrice: 38.0,
      packageOptions: [{ label: "Bottle (750ml)", value: "btl", price: 38.0 }],
    },
    {
      id: "5",
      name: "Hot Lid (9oz)",
      sku: "PL001",
      currentStock: 120,
      parLevel: 500,
      avgDailyUsage: 200,
      daysLeft: 0.6,
      supplier: "Unique Paper Sdn Bhd",
      supplierPhone: "+60133344556",
      suggestedQty: 380,
      uom: "pcs",
      unitPrice: 0.04,
      packageOptions: [
        { label: "Piece", value: "pcs", price: 0.04 },
        { label: "Pack (50 pcs)", value: "pack", price: 1.8 },
      ],
    },
  ],
};

const ORDER_HISTORY = [
  { id: "CC-IOI-0042", supplier: "Sri Ternak", items: 3, amount: 180.0, status: "sent" as const, date: "01/04/2026", sentVia: "whatsapp" as const },
  { id: "CC-IOI-0041", supplier: "Dankoff", items: 4, amount: 312.0, status: "completed" as const, date: "31/03/2026", sentVia: "whatsapp" as const },
  { id: "CC-IOI-0040", supplier: "Unique Paper Sdn Bhd", items: 5, amount: 42.0, status: "completed" as const, date: "30/03/2026", sentVia: "whatsapp" as const },
  { id: "CC-IOI-0039", supplier: "BGS Trading", items: 2, amount: 89.5, status: "completed" as const, date: "28/03/2026", sentVia: "whatsapp" as const },
  { id: "CC-IOI-0038", supplier: "Sri Ternak", items: 4, amount: 195.0, status: "completed" as const, date: "27/03/2026", sentVia: "whatsapp" as const },
];

const QUICK_REORDERS = [
  { supplier: "Sri Ternak", lastOrder: "CC-IOI-0042", date: "Today", items: [
    { name: "Fresh Milk", qty: 10, uom: "L" },
    { name: "Bawang Besar", qty: 5, uom: "kg" },
    { name: "Asam Jawa", qty: 3, uom: "pkt" },
  ]},
  { supplier: "Dankoff", lastOrder: "CC-IOI-0041", date: "Yesterday", items: [
    { name: "Oatmilk (Oatside)", qty: 6, uom: "btl" },
    { name: "DVG Blue Ocean Syrup", qty: 2, uom: "btl" },
    { name: "Monin Caramel Syrup", qty: 2, uom: "btl" },
    { name: "DVG Butterscotch Sauce", qty: 1, uom: "btl" },
  ]},
];

type CartItem = {
  id: string;
  name: string;
  supplier: string;
  supplierPhone: string;
  qty: number;
  uom: string;
  unitPrice: number;
};

export default function OrderPage() {
  const [activeTab, setActiveTab] = useState<"suggested" | "history" | "reorder">("suggested");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [whatsappDialog, setWhatsappDialog] = useState<{
    open: boolean;
    supplier: string;
    message: string;
    phone: string;
  }>({ open: false, supplier: "", message: "", phone: "" });

  const addToCart = (item: (typeof ORDER_SUGGESTIONS.urgent)[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev;
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          supplier: item.supplier,
          supplierPhone: item.supplierPhone,
          qty: item.suggestedQty,
          uom: item.uom,
          unitPrice: item.unitPrice,
        },
      ];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const isInCart = (id: string) => cart.some((c) => c.id === id);

  const cartTotal = cart.reduce((acc, c) => acc + c.qty * c.unitPrice, 0);

  // Group cart by supplier for WhatsApp sending
  const cartBySupplier = cart.reduce(
    (acc, item) => {
      if (!acc[item.supplier]) acc[item.supplier] = { items: [], phone: item.supplierPhone };
      acc[item.supplier].items.push(item);
      return acc;
    },
    {} as Record<string, { items: CartItem[]; phone: string }>
  );

  const sendViaWhatsApp = (supplier: string) => {
    const group = cartBySupplier[supplier];
    if (!group) return;

    const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
    const poNumber = `CC-IOI-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    let message = `📋 *Order from Celsius Coffee IOI Conezion*\n`;
    message += `Date: ${today}\n`;
    message += `PO #: ${poNumber}\n\n`;

    group.items.forEach((item, i) => {
      message += `${i + 1}. ${item.name} — ${item.qty} ${item.uom}\n`;
    });

    message += `\nDelivery: ${tomorrow}`;
    message += `\nOutlet: M-G-06, IOI City Resort, Putrajaya`;
    message += `\n\nThank you! 🙏`;

    setWhatsappDialog({ open: true, supplier, message, phone: group.phone });
  };

  const openWhatsApp = () => {
    const phone = whatsappDialog.phone.replace(/\+/g, "");
    const encoded = encodeURIComponent(whatsappDialog.message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    setWhatsappDialog({ open: false, supplier: "", message: "", phone: "" });
  };

  const renderItem = (item: (typeof ORDER_SUGGESTIONS.urgent)[0], urgency: "urgent" | "restock") => {
    const inCart = isInCart(item.id);
    const cartItem = cart.find((c) => c.id === item.id);

    return (
      <Card
        key={item.id}
        className={`overflow-hidden ${urgency === "urgent" ? "border-red-200" : "border-terracotta/30"}`}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                {urgency === "urgent" && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
              </div>
              <p className="text-xs text-gray-500">{item.supplier} &middot; {item.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                RM {(item.unitPrice * (cartItem?.qty || item.suggestedQty)).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">
                RM {item.unitPrice.toFixed(2)}/{item.uom}
              </p>
            </div>
          </div>

          {/* Stock info */}
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-gray-500">
              <TrendingDown className="h-3 w-3" />
              Stock: {item.currentStock} {item.uom}
            </span>
            <span className={`flex items-center gap-1 ${item.daysLeft < 1 ? "text-red-500" : "text-amber-500"}`}>
              <Clock className="h-3 w-3" />
              {item.daysLeft < 1 ? "< 1 day left" : `${item.daysLeft.toFixed(1)} days left`}
            </span>
          </div>

          {/* Add / quantity controls */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Suggested: {item.suggestedQty} {item.uom}
            </span>
            {inCart ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateCartQty(item.id, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600 active:bg-gray-200"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2rem] text-center text-sm font-semibold">
                  {cartItem?.qty}
                </span>
                <button
                  onClick={() => updateCartQty(item.id, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-terracotta/10 text-terracotta-dark active:bg-terracotta/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => addToCart(item)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add {item.suggestedQty} {item.uom}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <TopBar title="Smart Ordering" />

      {/* Tabs + Search */}
      <div className="sticky top-[73px] z-30 border-b border-gray-100 bg-white px-4 py-2">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex gap-1">
            {([
              { id: "suggested" as const, label: "Suggested", icon: AlertTriangle },
              { id: "reorder" as const, label: "Quick Reorder", icon: RotateCcw },
              { id: "history" as const, label: "History", icon: History },
            ]).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-terracotta text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {activeTab === "suggested" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mx-auto max-w-lg space-y-4">

      {/* Quick Reorder tab */}
      {activeTab === "reorder" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Repeat a previous order with one tap</p>
          {QUICK_REORDERS.map((reorder) => (
            <Card key={reorder.lastOrder} className="overflow-hidden">
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{reorder.supplier}</p>
                    <p className="text-xs text-gray-400">{reorder.lastOrder} &middot; {reorder.date}</p>
                  </div>
                  <Button size="sm" className="h-7 bg-green-600 hover:bg-green-700 text-xs">
                    <MessageCircle className="mr-1 h-3 w-3" />
                    Reorder
                  </Button>
                </div>
                <div className="mt-2 space-y-0.5">
                  {reorder.items.map((item, i) => (
                    <p key={i} className="text-xs text-gray-500">{item.qty} {item.uom} — {item.name}</p>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Order History tab */}
      {activeTab === "history" && (
        <div className="space-y-1.5">
          {ORDER_HISTORY.map((order) => (
            <Card key={order.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.supplier}</p>
                  <p className="text-xs text-gray-400">{order.id} &middot; {order.items} items &middot; {order.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">RM {order.amount.toFixed(0)}</span>
                  <Badge className={`text-[10px] ${order.status === "sent" ? "bg-green-500" : order.status === "completed" ? "bg-gray-400" : "bg-terracotta"}`}>{order.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "suggested" && (<>
          {/* Urgent section */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                Urgent — Below Minimum
              </h2>
              <Badge variant="destructive" className="text-[10px]">
                {ORDER_SUGGESTIONS.urgent.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {ORDER_SUGGESTIONS.urgent.map((item) => renderItem(item, "urgent"))}
            </div>
          </div>

          {/* Restock soon */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-terracotta" />
              <h2 className="text-sm font-semibold text-gray-900">
                Restock Soon — 1-2 Days Left
              </h2>
              <Badge className="bg-terracotta/10 text-[10px] text-terracotta-dark">
                {ORDER_SUGGESTIONS.restockSoon.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {ORDER_SUGGESTIONS.restockSoon.map((item) => renderItem(item, "restock"))}
            </div>
          </div>

          {/* OK items */}
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                195 items at healthy stock levels
              </span>
            </div>
          </div>
        </>
      )}
        </div>
      </div>

      {/* Cart summary bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-gray-600">
                <ShoppingCart className="h-4 w-4" />
                {cart.length} items
              </span>
              <span className="font-semibold text-gray-900">
                RM {cartTotal.toFixed(2)}
              </span>
            </div>

            {/* Grouped by supplier — one WhatsApp button per supplier */}
            <div className="flex flex-col gap-1.5">
              {Object.entries(cartBySupplier).map(([supplier, group]) => (
                <Button
                  key={supplier}
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => sendViaWhatsApp(supplier)}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Send to {supplier} ({group.items.length} items)
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp preview dialog */}
      <Dialog
        open={whatsappDialog.open}
        onOpenChange={(open) => setWhatsappDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="mx-auto max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Order to {whatsappDialog.supplier}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-green-50 p-3">
              <pre className="whitespace-pre-wrap text-xs text-gray-700">
                {whatsappDialog.message}
              </pre>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={openWhatsApp}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Open WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
