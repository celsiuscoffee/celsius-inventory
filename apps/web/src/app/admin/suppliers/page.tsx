"use client";

import { useState } from "react";
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
  Plus,
  Search,
  Pencil,
  Trash2,
  Truck,
  Phone,
  MapPin,
  Clock,
  Package,
  Star,
  TrendingUp,
  ChevronDown,
  MessageCircle,
} from "lucide-react";

const SUPPLIERS = [
  {
    id: "1", name: "Sri Ternak", location: "Putrajaya", phone: "+60123456789", status: "active" as const,
    leadTimeDays: 1, supplierCode: "ST001", tags: ["Fresh", "Daily"],
    products: [
      { name: "Fresh Milk", sku: "DFM001", package: "Liter", price: 5.00 },
      { name: "Bawang Besar", sku: "FV007", package: "Kilogram", price: 2.50 },
      { name: "Asam Jawa", sku: "SE016", package: "Packet (1000g)", price: 3.00 },
      { name: "Sugar Packet", sku: "S0001", package: "Pcs", price: 0.05 },
      { name: "Condensed Milk", sku: "D0003", package: "Tin (392g)", price: 4.20 },
      { name: "Beras", sku: "RMM01", package: "Bag (5kg)", price: 12.50 },
    ],
    scorecard: { onTime: 92, shortDelivery: 8, priceChange: 1.2, avgLeadTime: 1.1 },
  },
  {
    id: "2", name: "Dankoff", location: "Seri Kembangan", phone: "+60112233445", status: "active" as const,
    leadTimeDays: 2, supplierCode: "DK001", tags: ["Syrups", "Dairy"],
    products: [
      { name: "Monin Caramel Syrup", sku: "FM001", package: "Bottle (1000ml)", price: 52.00 },
      { name: "Monin Salted Caramel", sku: "FM003", package: "Bottle (1000ml)", price: 52.00 },
      { name: "Oatmilk (Oatside)", sku: "DO001", package: "Bottle (1000ml)", price: 52.00 },
      { name: "DVG Blue Ocean Syrup", sku: "FD003", package: "Bottle (750ml)", price: 38.00 },
      { name: "DVG Classic Pepper Mint", sku: "FD001", package: "Bottle (750ml)", price: 38.00 },
      { name: "DVG Butterscotch Sauce", sku: "FD010", package: "Bottle (2000ml)", price: 65.00 },
    ],
    scorecard: { onTime: 88, shortDelivery: 4, priceChange: 0.5, avgLeadTime: 2.1 },
  },
  {
    id: "3", name: "365EAT FOOD", location: "Bandar Baru Bangi", phone: "+60198765432", status: "active" as const,
    leadTimeDays: 1, supplierCode: "365E01", tags: ["Food", "Meat"],
    products: [
      { name: "Smoked Duck", sku: "M0006", package: "Kilogram", price: 45.00 },
      { name: "Almond Salted Crepe", sku: "CC001", package: "Slice (Cake)", price: 9.16 },
    ],
    scorecard: { onTime: 95, shortDelivery: 2, priceChange: 3.5, avgLeadTime: 1.0 },
  },
  {
    id: "4", name: "Unique Paper Sdn Bhd", location: "Shah Alam", phone: "+60133344556", status: "active" as const,
    leadTimeDays: 3, supplierCode: "UP001", tags: ["Packaging"],
    products: [
      { name: "Hot Lid (9oz)", sku: "PL001", package: "Piece", price: 0.04 },
      { name: "Plastic Cup", sku: "PC003", package: "Piece", price: 0.04 },
      { name: "Iced Strawless Lid", sku: "PL002", package: "Piece", price: 0.04 },
      { name: "Paperbag M", sku: "PP0002", package: "Piece", price: 0.15 },
      { name: "Paperbag L", sku: "PP0003", package: "Piece", price: 0.20 },
      { name: "Air Fryer Paper", sku: "PAP001", package: "Pack", price: 0.04 },
      { name: "Aluminium Foil", sku: "PAP004", package: "Roll", price: 0.00 },
    ],
    scorecard: { onTime: 85, shortDelivery: 12, priceChange: 0.0, avgLeadTime: 3.2 },
  },
  {
    id: "5", name: "BGS Trading", location: "Subang Jaya", phone: "+60145566778", status: "active" as const,
    leadTimeDays: 2, supplierCode: "BGS01", tags: ["Dairy", "Cheese"],
    products: [
      { name: "Anchor Cheese Slice", sku: "RMA03", package: "Piece (250g)", price: 8.50 },
      { name: "Anchor Salt Butter", sku: "RMA01", package: "Piece (250g)", price: 13.00 },
    ],
    scorecard: { onTime: 90, shortDelivery: 5, priceChange: 2.1, avgLeadTime: 1.8 },
  },
  {
    id: "6", name: "Blancoz", location: "Puchong", phone: "+60156677889", status: "active" as const,
    leadTimeDays: 2, supplierCode: "BLZ01", tags: ["Coffee"],
    products: [],
    scorecard: { onTime: 93, shortDelivery: 3, priceChange: 0.8, avgLeadTime: 2.0 },
  },
];

type SupplierForm = {
  name: string;
  location: string;
  phone: string;
  supplierCode: string;
  leadTimeDays: string;
  tags: string;
};

const emptyForm: SupplierForm = { name: "", location: "", phone: "", supplierCode: "", leadTimeDays: "1", tags: "" };

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<(typeof SUPPLIERS)[0] | null>(null);

  const filtered = SUPPLIERS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };

  const openEdit = (supplier: (typeof SUPPLIERS)[0]) => {
    setForm({
      name: supplier.name, location: supplier.location, phone: supplier.phone,
      supplierCode: supplier.supplierCode, leadTimeDays: supplier.leadTimeDays.toString(),
      tags: supplier.tags.join(", "),
    });
    setEditingId(supplier.id);
    setDialogOpen(true);
  };

  const openPriceList = (supplier: (typeof SUPPLIERS)[0]) => {
    setSelectedSupplier(supplier);
    setPriceDialogOpen(true);
  };

  const updateField = (key: keyof SupplierForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Suppliers</h2>
          <p className="mt-0.5 text-sm text-gray-500">{SUPPLIERS.length} suppliers with product pricing and scorecards</p>
        </div>
        <Button onClick={openAdd} className="bg-terracotta hover:bg-terracotta-dark">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by name, code, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      {/* Supplier cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {filtered.map((supplier) => (
          <Card key={supplier.id} className="overflow-hidden">
            <div className="p-4">
              {/* Supplier header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 font-bold text-sm">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                      <Badge variant={supplier.status === "active" ? "default" : "secondary"} className={`text-[10px] ${supplier.status === "active" ? "bg-green-500" : ""}`}>
                        {supplier.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.location}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{supplier.leadTimeDays}d lead time</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(supplier)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Contact */}
              <div className="mt-3 flex items-center gap-3">
                <a href={`https://wa.me/${supplier.phone.replace("+", "")}`} target="_blank" className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 hover:bg-green-100">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
                <span className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{supplier.phone}</span>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{supplier.supplierCode}</code>
              </div>

              {/* Tags */}
              <div className="mt-2 flex flex-wrap gap-1">
                {supplier.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>

              {/* Scorecard */}
              <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-2">
                <div className="text-center">
                  <p className={`text-sm font-bold ${supplier.scorecard.onTime >= 90 ? "text-green-600" : supplier.scorecard.onTime >= 80 ? "text-terracotta" : "text-red-600"}`}>
                    {supplier.scorecard.onTime}%
                  </p>
                  <p className="text-[10px] text-gray-500">On-time</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${supplier.scorecard.shortDelivery <= 5 ? "text-green-600" : supplier.scorecard.shortDelivery <= 10 ? "text-terracotta" : "text-red-600"}`}>
                    {supplier.scorecard.shortDelivery}%
                  </p>
                  <p className="text-[10px] text-gray-500">Short</p>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${supplier.scorecard.priceChange <= 1 ? "text-green-600" : supplier.scorecard.priceChange <= 3 ? "text-terracotta" : "text-red-600"}`}>
                    +{supplier.scorecard.priceChange}%
                  </p>
                  <p className="text-[10px] text-gray-500">Price Δ</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700">{supplier.scorecard.avgLeadTime}d</p>
                  <p className="text-[10px] text-gray-500">Avg Lead</p>
                </div>
              </div>

              {/* Products */}
              <div className="mt-3">
                <button
                  onClick={() => openPriceList(supplier)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Package className="h-3.5 w-3.5 text-gray-400" />
                    {supplier.products.length} products
                  </span>
                  <span className="text-xs text-terracotta">View price list →</span>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Supplier Name</label>
                <Input className="mt-1" placeholder="e.g. Sri Ternak" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Supplier Code</label>
                <Input className="mt-1" placeholder="e.g. ST001" value={form.supplierCode} onChange={(e) => updateField("supplierCode", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Location</label>
                <Input className="mt-1" placeholder="e.g. Putrajaya" value={form.location} onChange={(e) => updateField("location", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
                <Input className="mt-1" placeholder="+60123456789" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Lead Time (days)</label>
                <Input className="mt-1" type="number" min="1" placeholder="1" value={form.leadTimeDays} onChange={(e) => updateField("leadTimeDays", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tags</label>
                <Input className="mt-1" placeholder="Fresh, Daily" value={form.tags} onChange={(e) => updateField("tags", e.target.value)} />
              </div>
            </div>
            <Button className="w-full bg-terracotta hover:bg-terracotta-dark">
              {editingId ? "Save Changes" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price List Dialog */}
      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.name} — Price List</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="py-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{selectedSupplier.products.length} products</p>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-3 w-3" />
                  Add Product
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Product</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Package</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Price (RM)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplier.products.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-900">{p.name}</td>
                        <td className="px-3 py-2"><code className="rounded bg-gray-100 px-1 text-xs">{p.sku}</code></td>
                        <td className="px-3 py-2 text-gray-600">{p.package}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{p.price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">
                          <button className="text-gray-400 hover:text-gray-600"><Pencil className="h-3 w-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
