"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Trash2, AlertTriangle, Camera } from "lucide-react";

const RECENT_WASTAGE = [
  { id: "W-001", product: "Fresh Milk", qty: 2.5, uom: "L", reason: "Expired", cost: 12.50, date: "01/04/2026", recordedBy: "Adam Haziq" },
  { id: "W-002", product: "Monin Caramel Syrup", qty: 200, uom: "ml", reason: "Spillage", cost: 10.40, date: "31/03/2026", recordedBy: "Syafa" },
  { id: "W-003", product: "Plastic Cup", qty: 15, uom: "pcs", reason: "Breakage", cost: 0.60, date: "31/03/2026", recordedBy: "Syafa" },
  { id: "W-004", product: "Almond Croissant", qty: 2, uom: "pcs", reason: "Expired", cost: 17.00, date: "30/03/2026", recordedBy: "Adam Haziq" },
];

const REASONS = ["Expired", "Spillage", "Breakage", "Theft/Loss", "Wrong preparation", "Contaminated", "Other"];

export default function WastagePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const totalWaste = RECENT_WASTAGE.reduce((a, w) => a + w.cost, 0);

  return (
    <>
      <TopBar title="Record Wastage" />
      <div className="px-4 py-3">
        <div className="mx-auto max-w-lg space-y-4">
          {/* Summary */}
          <Card className="bg-red-50 border-red-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-500">This Week&apos;s Waste</p>
                <p className="text-xl font-bold text-red-700">RM {totalWaste.toFixed(2)}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-300" />
            </div>
          </Card>

          <Button onClick={() => setDialogOpen(true)} className="w-full bg-terracotta hover:bg-terracotta-dark">
            <Plus className="mr-1.5 h-4 w-4" />
            Record Wastage
          </Button>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent Wastage</h2>
            <div className="space-y-1.5">
              {RECENT_WASTAGE.map((w) => (
                <Card key={w.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{w.product}</p>
                      <p className="text-xs text-gray-500">
                        {w.qty} {w.uom} &middot; {w.reason} &middot; {w.date}
                      </p>
                      <p className="text-xs text-gray-400">by {w.recordedBy}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">-RM {w.cost.toFixed(2)}</p>
                      <Badge variant="outline" className="text-[10px]">{w.reason}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-auto max-w-sm">
          <DialogHeader><DialogTitle>Record Wastage</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Product</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Search product..." className="pl-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Quantity</label><Input className="mt-1" type="number" inputMode="decimal" placeholder="0" /></div>
              <div><label className="text-sm font-medium">UOM</label><select className="mt-1 w-full rounded-md border px-3 py-2 text-sm"><option>pcs</option><option>ml</option><option>g</option><option>L</option><option>kg</option></select></div>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${reason === r ? "border-terracotta bg-terracotta/5 text-terracotta-dark" : "border-gray-200 text-gray-600"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div><label className="text-sm font-medium">Notes (optional)</label><Input className="mt-1" placeholder="Additional details..." /></div>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-terracotta hover:text-terracotta">
              <Camera className="h-4 w-4" />
              Take photo (optional)
            </button>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Record Wastage
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
