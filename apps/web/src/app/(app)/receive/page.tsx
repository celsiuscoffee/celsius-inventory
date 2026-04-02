"use client";

import { useState, useRef } from "react";
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
  Package,
  Camera,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  Truck,
  FileText,
  X,
} from "lucide-react";

// Mock pending deliveries
const PENDING_DELIVERIES = [
  {
    id: "po-042",
    orderNumber: "CC-IOI-0042",
    supplier: "Sri Ternak",
    itemCount: 3,
    totalAmount: 180.0,
    expectedDate: "Today",
    items: [
      { id: "i1", name: "Fresh Milk", sku: "DFM001", orderedQty: 10, uom: "L", unitPrice: 5.0 },
      { id: "i2", name: "Bawang Besar", sku: "FV007", orderedQty: 5, uom: "kg", unitPrice: 2.5 },
      { id: "i3", name: "Asam Jawa", sku: "SE016", orderedQty: 3, uom: "pkt", unitPrice: 3.0 },
    ],
  },
  {
    id: "po-045",
    orderNumber: "CC-IOI-0045",
    supplier: "Dankoff",
    itemCount: 2,
    totalAmount: 156.0,
    expectedDate: "Today",
    items: [
      { id: "i4", name: "Oatmilk (Oatside)", sku: "DO001", orderedQty: 2, uom: "btl", unitPrice: 52.0 },
      { id: "i5", name: "Monin Caramel Syrup", sku: "FM001", orderedQty: 1, uom: "btl", unitPrice: 52.0 },
    ],
  },
];

const RECENT_RECEIVED = [
  { id: "r1", orderNumber: "CC-IOI-0039", supplier: "Unique Paper Sdn Bhd", date: "Yesterday", status: "complete" as const, amount: 42.0 },
  { id: "r2", orderNumber: "CC-IOI-0037", supplier: "BGS Trading", date: "2 days ago", status: "partial" as const, amount: 89.5 },
];

interface ReceivedQty {
  [itemId: string]: { qty: string; hasDiscrepancy: boolean; reason?: string };
}

export default function ReceivePage() {
  const [selectedPO, setSelectedPO] = useState<(typeof PENDING_DELIVERIES)[0] | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<ReceivedQty>({});
  const [invoicePhotos, setInvoicePhotos] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPO = (po: (typeof PENDING_DELIVERIES)[0]) => {
    setSelectedPO(po);
    setReceivedQtys({});
    setInvoicePhotos([]);
    setExpiryDates({});
  };

  const updateReceivedQty = (itemId: string, qty: string) => {
    setReceivedQtys((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        qty,
        hasDiscrepancy: false,
      },
    }));
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setInvoicePhotos((prev) => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setInvoicePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const allReceived = selectedPO?.items.every((item) => receivedQtys[item.id]?.qty !== undefined && receivedQtys[item.id]?.qty !== "");

  const hasDiscrepancies = selectedPO?.items.some((item) => {
    const received = receivedQtys[item.id];
    return received && parseFloat(received.qty) !== item.orderedQty;
  });

  const submitReceiving = () => {
    setSelectedPO(null);
    setReceivedQtys({});
    setInvoicePhotos([]);
  };

  return (
    <>
      <TopBar title="Receive & Capture" />

      {!selectedPO ? (
        <div className="px-4 py-3">
          <div className="mx-auto max-w-lg space-y-4">
            {/* Expected today */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Truck className="h-4 w-4 text-terracotta" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Expected Today
                </h2>
                <Badge className="bg-terracotta/10 text-[10px] text-terracotta-dark">
                  {PENDING_DELIVERIES.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {PENDING_DELIVERIES.map((po) => (
                  <Card
                    key={po.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => openPO(po)}
                  >
                    <div className="flex items-center justify-between px-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {po.supplier}
                        </p>
                        <p className="text-xs text-gray-500">
                          {po.orderNumber} &middot; {po.itemCount} items &middot; RM{" "}
                          {po.totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {po.expectedDate}
                        </Badge>
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Quick capture — no PO linked */}
            <Card className="border-dashed border-gray-300">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-3 px-3 py-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Camera className="h-5 w-5 text-gray-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    Quick Invoice Capture
                  </p>
                  <p className="text-xs text-gray-500">
                    Snap an invoice without linking to a PO
                  </p>
                </div>
              </button>
            </Card>

            {/* Recent */}
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                Recently Received
              </h2>
              <div className="space-y-1.5">
                {RECENT_RECEIVED.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm text-gray-900">{r.supplier}</p>
                      <p className="text-xs text-gray-400">
                        {r.orderNumber} &middot; {r.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        RM {r.amount.toFixed(2)}
                      </span>
                      {r.status === "complete" ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Receiving detail view */
        <div className="px-4 py-3">
          <div className="mx-auto max-w-lg space-y-3">
            {/* PO header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedPO.supplier}
                </h2>
                <p className="text-xs text-gray-500">{selectedPO.orderNumber}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPO(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Items to receive */}
            <div className="space-y-2">
              {selectedPO.items.map((item) => {
                const received = receivedQtys[item.id];
                const receivedNum = received ? parseFloat(received.qty) : NaN;
                const isShort = !isNaN(receivedNum) && receivedNum < item.orderedQty;
                const isOver = !isNaN(receivedNum) && receivedNum > item.orderedQty;
                const isMatch = !isNaN(receivedNum) && receivedNum === item.orderedQty;

                return (
                  <Card
                    key={item.id}
                    className={`overflow-hidden ${
                      isShort ? "border-red-200" : isMatch ? "border-green-200" : ""
                    }`}
                  >
                    <div className="px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Ordered: {item.orderedQty} {item.uom}
                          </p>
                        </div>
                        {isMatch && <Check className="h-5 w-5 text-green-500" />}
                        {isShort && (
                          <Badge variant="destructive" className="text-[10px]">
                            Short {item.orderedQty - receivedNum} {item.uom}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-gray-500">Received:</label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder={`${item.orderedQty}`}
                          value={received?.qty ?? ""}
                          onChange={(e) => updateReceivedQty(item.id, e.target.value)}
                          className="h-8 w-24 text-center"
                        />
                        <span className="text-xs text-gray-500">{item.uom}</span>

                        {/* Quick match button */}
                        {!isMatch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600"
                            onClick={() =>
                              updateReceivedQty(item.id, String(item.orderedQty))
                            }
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Match
                          </Button>
                        )}
                      </div>

                      {/* Expiry date for perishables */}
                      {(item.name.includes("Milk") || item.name.includes("milk")) && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-gray-500">Expiry:</label>
                          <Input
                            type="date"
                            value={expiryDates[item.id] ?? ""}
                            onChange={(e) =>
                              setExpiryDates((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-8 w-40 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Invoice photo capture */}
            <div>
              <h3 className="mb-1.5 text-sm font-medium text-gray-900">
                Invoice Photo
              </h3>
              <div className="flex flex-wrap gap-2">
                {invoicePhotos.map((photo, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                    <img src={photo} alt={`Invoice ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-terracotta hover:text-terracotta"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px]">Add Photo</span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pb-16">
              {hasDiscrepancies && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-terracotta/5 px-3 py-2 text-xs text-terracotta-dark">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Some quantities don&apos;t match. Discrepancies will be flagged for follow-up.</span>
                </div>
              )}
              <Button
                className="w-full bg-terracotta hover:bg-terracotta-dark"
                disabled={!allReceived}
                onClick={submitReceiving}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                Confirm Received
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handlePhotoCapture}
      />
    </>
  );
}
