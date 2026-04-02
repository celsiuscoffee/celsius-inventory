"use client";

import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRightLeft, Plus, Search, ArrowRight, Check } from "lucide-react";

const RECENT_TRANSFERS = [
  { id: "TF-001", from: "IOI Conezion", to: "Shah Alam", items: 3, status: "completed" as const, date: "30/03/2026", transferredBy: "Ammar" },
  { id: "TF-002", from: "Shah Alam", to: "Tamarind", items: 2, status: "pending" as const, date: "01/04/2026", transferredBy: "Syerry Tg" },
];

export default function TransferPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <TopBar title="Stock Transfer" />
      <div className="px-4 py-3">
        <div className="mx-auto max-w-lg space-y-4">
          <Button onClick={() => setDialogOpen(true)} className="w-full bg-terracotta hover:bg-terracotta-dark">
            <Plus className="mr-1.5 h-4 w-4" />
            New Transfer
          </Button>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent Transfers</h2>
            <div className="space-y-2">
              {RECENT_TRANSFERS.map((t) => (
                <Card key={t.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">{t.from}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-medium text-gray-900">{t.to}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{t.id} &middot; {t.items} items &middot; {t.date} &middot; by {t.transferredBy}</p>
                    </div>
                    <Badge className={`text-[10px] ${t.status === "completed" ? "bg-green-500" : "bg-terracotta"}`}>{t.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-auto max-w-sm">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">From Branch</label>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                <option>Celsius Coffee IOI Conezion</option>
                <option>Celsius Coffee Shah Alam</option>
                <option>Celsius Coffee Tamarind</option>
                <option>Celsius Coffee Nilai</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">To Branch</label>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                <option>Celsius Coffee Shah Alam</option>
                <option>Celsius Coffee IOI Conezion</option>
                <option>Celsius Coffee Tamarind</option>
                <option>Celsius Coffee Nilai</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Search Products</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Search by name or SKU..." className="pl-9" />
              </div>
            </div>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">
              <ArrowRightLeft className="mr-1.5 h-4 w-4" />
              Create Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
