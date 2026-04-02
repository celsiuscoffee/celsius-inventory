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
  Check,
  X,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ScanBarcode,
  Clock,
  RotateCcw,
} from "lucide-react";

// Different items for daily vs monthly
const DAILY_ITEMS = [
  {
    area: "Fridge",
    items: [
      { id: "d1", name: "Fresh Milk", sku: "DFM001", expectedQty: 8, uom: "L", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d2", name: "Oatmilk (Oatside)", sku: "DO001", expectedQty: 3, uom: "btl", urgency: "low" as const, lastCount: "6h ago" },
      { id: "d3", name: "Anchor Salt Butter", sku: "RMA01", expectedQty: 2, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d4", name: "Smoked Duck", sku: "M0006", expectedQty: 0.5, uom: "kg", urgency: "urgent" as const, lastCount: "6h ago" },
    ],
  },
  {
    area: "Counter",
    items: [
      { id: "d5", name: "Hot Lid (9oz)", sku: "PL001", expectedQty: 120, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d6", name: "Iced Strawless Lid", sku: "PL002", expectedQty: 80, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d7", name: "Plastic Cup", sku: "PC003", expectedQty: 95, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d8", name: "Straw Milkshake", sku: "PS0002", expectedQty: 50, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
    ],
  },
  {
    area: "Dry Store",
    items: [
      { id: "d9", name: "Monin Caramel Syrup", sku: "FM001", expectedQty: 1.5, uom: "btl", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d10", name: "Sugar Packet", sku: "S0001", expectedQty: 45, uom: "pcs", urgency: "ok" as const, lastCount: "6h ago" },
      { id: "d11", name: "DVG Blue Ocean Syrup", sku: "FD003", expectedQty: 1, uom: "btl", urgency: "low" as const, lastCount: "6h ago" },
    ],
  },
];

const MONTHLY_ITEMS = [
  {
    area: "Dry Store (Bulk)",
    items: [
      { id: "m1", name: "Monin Caramel Syrup", sku: "FM001", expectedQty: 4, uom: "btl", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m2", name: "Monin Salted Caramel", sku: "FM003", expectedQty: 3, uom: "btl", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m3", name: "DVG Blue Ocean Syrup", sku: "FD003", expectedQty: 5, uom: "btl", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m4", name: "DVG Butterscotch Sauce", sku: "FD010", expectedQty: 2, uom: "btl", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m5", name: "Condensed Milk", sku: "D0003", expectedQty: 12, uom: "tin", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m6", name: "Beras", sku: "RMM01", expectedQty: 2, uom: "bag (5kg)", urgency: "ok" as const, lastCount: "28d ago" },
    ],
  },
  {
    area: "Packaging Store",
    items: [
      { id: "m7", name: "Hot Lid (9oz)", sku: "PL001", expectedQty: 10, uom: "pack (50)", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m8", name: "Plastic Cup", sku: "PC003", expectedQty: 8, uom: "pack (50)", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m9", name: "Paperbag M", sku: "PP0002", expectedQty: 200, uom: "pcs", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m10", name: "Paperbag L", sku: "PP0003", expectedQty: 100, uom: "pcs", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m11", name: "Cup Holder (2)", sku: "PP0005", expectedQty: 300, uom: "pcs", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m12", name: "Aluminium Foil", sku: "PAP004", expectedQty: 4, uom: "roll", urgency: "ok" as const, lastCount: "28d ago" },
    ],
  },
  {
    area: "Fridge (Bulk)",
    items: [
      { id: "m13", name: "Oatmilk (Oatside)", sku: "DO001", expectedQty: 1, uom: "ctn (6btl)", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m14", name: "Anchor Salt Butter", sku: "RMA01", expectedQty: 8, uom: "pcs", urgency: "ok" as const, lastCount: "28d ago" },
      { id: "m15", name: "Anchor Cheese Slice", sku: "RMA03", expectedQty: 4, uom: "pkt", urgency: "ok" as const, lastCount: "28d ago" },
    ],
  },
];

const ADJUSTMENT_REASONS = [
  "Wastage/Spillage",
  "Breakage",
  "Expired",
  "Used but not recorded",
  "Theft/Loss",
  "Other",
];

type CheckStatus = "pending" | "confirmed" | "adjusted";
interface ItemState {
  status: CheckStatus;
  actualQty?: number;
  reason?: string;
}

export default function StockCheckPage() {
  const [frequency, setFrequency] = useState<"daily" | "monthly">("daily");
  const [search, setSearch] = useState("");
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [adjustDialog, setAdjustDialog] = useState<{
    open: boolean;
    itemId: string;
    itemName: string;
    expectedQty: number;
    uom: string;
  }>({ open: false, itemId: "", itemName: "", expectedQty: 0, uom: "" });
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [hasDraft, setHasDraft] = useState(true);

  const data = frequency === "daily" ? DAILY_ITEMS : MONTHLY_ITEMS;
  const totalItems = data.reduce((acc, g) => acc + g.items.length, 0);
  const checkedItems = Object.values(itemStates).filter(
    (s) => s.status === "confirmed" || s.status === "adjusted"
  ).length;
  const adjustedItems = Object.values(itemStates).filter(
    (s) => s.status === "adjusted"
  ).length;

  const toggleArea = (area: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const confirmItem = (id: string) => {
    setItemStates((prev) => ({ ...prev, [id]: { status: "confirmed" } }));
  };

  const confirmArea = (area: string) => {
    const group = data.find((g) => g.area === area);
    if (!group) return;
    setItemStates((prev) => {
      const next = { ...prev };
      group.items.forEach((item) => {
        if (!next[item.id] || next[item.id].status === "pending") {
          next[item.id] = { status: "confirmed" };
        }
      });
      return next;
    });
  };

  const openAdjustDialog = (item: {
    id: string;
    name: string;
    expectedQty: number;
    uom: string;
  }) => {
    setAdjustDialog({
      open: true,
      itemId: item.id,
      itemName: item.name,
      expectedQty: item.expectedQty,
      uom: item.uom,
    });
    setAdjustQty("");
    setAdjustReason("");
  };

  const submitAdjustment = () => {
    if (!adjustQty) return;
    setItemStates((prev) => ({
      ...prev,
      [adjustDialog.itemId]: {
        status: "adjusted",
        actualQty: parseFloat(adjustQty),
        reason: adjustReason,
      },
    }));
    setAdjustDialog({
      open: false,
      itemId: "",
      itemName: "",
      expectedQty: 0,
      uom: "",
    });
  };

  const confirmAll = () => {
    const newStates: Record<string, ItemState> = { ...itemStates };
    data.forEach((group) =>
      group.items.forEach((item) => {
        if (!newStates[item.id]) {
          newStates[item.id] = { status: "confirmed" };
        }
      })
    );
    setItemStates(newStates);
  };

  const resetCheck = () => {
    setItemStates({});
  };

  const switchFrequency = (f: "daily" | "monthly") => {
    setFrequency(f);
    setItemStates({});
    setCollapsedAreas(new Set());
  };

  const filteredData = data
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.sku.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <TopBar title="Smart Stock Check" />

      {/* Frequency toggle + progress */}
      <div className="border-b border-gray-100 bg-white px-4 py-2">
        <div className="mx-auto max-w-lg">
          {/* Daily / Monthly toggle */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={() => switchFrequency("daily")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  frequency === "daily"
                    ? "bg-terracotta text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Daily ({DAILY_ITEMS.reduce((a, g) => a + g.items.length, 0)})
              </button>
              <button
                onClick={() => switchFrequency("monthly")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  frequency === "monthly"
                    ? "bg-terracotta text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Monthly (
                {MONTHLY_ITEMS.reduce((a, g) => a + g.items.length, 0)})
              </button>
            </div>
            {checkedItems > 0 && (
              <button
                onClick={resetCheck}
                className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              <span className="font-semibold text-gray-900">
                {checkedItems}/{totalItems}
              </span>{" "}
              checked
              {adjustedItems > 0 && (
                <span className="ml-1 text-terracotta">
                  ({adjustedItems} adjusted)
                </span>
              )}
            </span>
            <Badge
              variant={
                checkedItems === totalItems ? "default" : "secondary"
              }
              className={
                checkedItems === totalItems ? "bg-green-500" : ""
              }
            >
              {Math.round((checkedItems / totalItems) * 100)}%
            </Badge>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-terracotta transition-all duration-500"
              style={{
                width: `${(checkedItems / totalItems) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Search + scan */}
      <div className="sticky top-[73px] z-30 border-b border-gray-100 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-lg gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search product or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0">
            <ScanBarcode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stock items grouped by storage area */}
      <div className="px-4 py-3">
        <div className="mx-auto max-w-lg space-y-3">
          {filteredData.map((group) => {
            const isCollapsed = collapsedAreas.has(group.area);
            const groupTotal = group.items.length;
            const groupChecked = group.items.filter(
              (i) =>
                itemStates[i.id]?.status === "confirmed" ||
                itemStates[i.id]?.status === "adjusted"
            ).length;
            const allChecked = groupChecked === groupTotal;
            const hasUrgent = group.items.some(
              (i) =>
                (i.urgency === "urgent" || i.urgency === "low") &&
                !itemStates[i.id]
            );

            return (
              <div key={group.area}>
                {/* Area header with confirm-all-area button */}
                <div className="flex items-center justify-between py-1.5">
                  <button
                    onClick={() => toggleArea(group.area)}
                    className="flex items-center gap-2"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {group.area}
                    </span>
                    <span
                      className={`text-xs ${allChecked ? "text-green-500" : "text-gray-400"}`}
                    >
                      {groupChecked}/{groupTotal}
                    </span>
                    {hasUrgent && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </button>
                  {!allChecked && !isCollapsed && (
                    <button
                      onClick={() => confirmArea(group.area)}
                      className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-100"
                    >
                      <Check className="h-3 w-3" />
                      All correct
                    </button>
                  )}
                  {allChecked && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </div>

                {!isCollapsed && (
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const state = itemStates[item.id];
                      const isChecked =
                        state?.status === "confirmed" ||
                        state?.status === "adjusted";

                      return (
                        <Card
                          key={item.id}
                          className={`overflow-hidden transition-all ${
                            isChecked ? "opacity-50" : ""
                          } ${
                            item.urgency === "urgent" && !isChecked
                              ? "border-red-200 bg-red-50"
                              : item.urgency === "low" && !isChecked
                                ? "border-terracotta/30 bg-terracotta/5"
                                : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 px-3 py-2">
                            {/* Status */}
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                                state?.status === "confirmed"
                                  ? "bg-green-100 text-green-600"
                                  : state?.status === "adjusted"
                                    ? "bg-terracotta/10 text-terracotta"
                                    : item.urgency === "urgent"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              {state?.status === "confirmed" ? (
                                <Check className="h-4 w-4" />
                              ) : state?.status === "adjusted" ? (
                                <span className="text-[10px] font-bold">
                                  {state.actualQty}
                                </span>
                              ) : item.urgency === "urgent" ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              ) : (
                                <span className="text-[10px]">
                                  {item.sku.slice(0, 4)}
                                </span>
                              )}
                            </div>

                            {/* Product info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>
                                  Expected:{" "}
                                  <span className="font-semibold text-gray-700">
                                    {item.expectedQty} {item.uom}
                                  </span>
                                </span>
                                {state?.status === "adjusted" && (
                                  <span className="text-terracotta">
                                    → {state.actualQty} {item.uom}
                                  </span>
                                )}
                                <span className="flex items-center gap-0.5 text-gray-400">
                                  <Clock className="h-2.5 w-2.5" />
                                  {item.lastCount}
                                </span>
                              </div>
                            </div>

                            {/* Action buttons */}
                            {!isChecked && (
                              <div className="flex shrink-0 gap-1">
                                <button
                                  onClick={() => confirmItem(item.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 active:bg-green-200"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openAdjustDialog(item)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 active:bg-red-200"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={confirmAll}
            disabled={checkedItems === totalItems}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Confirm All
          </Button>
          <Button
            className="flex-1 bg-terracotta hover:bg-terracotta-dark"
            disabled={checkedItems < totalItems}
          >
            Submit Check
          </Button>
        </div>
      </div>

      {/* Adjust dialog */}
      <Dialog
        open={adjustDialog.open}
        onOpenChange={(open) =>
          setAdjustDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="mx-auto max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust: {adjustDialog.itemName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="mb-1 text-sm text-gray-500">
                Expected: {adjustDialog.expectedQty} {adjustDialog.uom}
              </p>
              <label className="text-sm font-medium">Actual Quantity</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={`Enter actual ${adjustDialog.uom}`}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ADJUSTMENT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setAdjustReason(reason)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      adjustReason === reason
                        ? "border-terracotta bg-terracotta/5 text-terracotta-dark"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={submitAdjustment}
              disabled={!adjustQty || !adjustReason}
              className="w-full bg-terracotta hover:bg-terracotta-dark"
            >
              Save Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
