"use client";

import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useFetch } from "@/lib/use-fetch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  ChevronDown,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Upload,
  X,
  ImageIcon,
  DollarSign,
  Clock,
  CheckCircle2,
  UserCircle,
  FileText,
  Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type ClaimItem = {
  id: string;
  productId: string;
  product: string;
  sku: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type Claim = {
  id: string;
  orderNumber: string;
  outlet: string;
  outletCode: string;
  supplierId: string;
  supplier: string;
  claimedBy: string | null;
  createdBy: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  items: ClaimItem[];
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    photoCount: number;
  } | null;
};

type OutletOption = { id: string; code: string; name: string };
type SupplierOption = { id: string; name: string; products: SupplierProduct[] };
type SupplierProduct = {
  id: string;
  name: string;
  sku: string;
  packageId: string | null;
  packageLabel: string;
  price: number;
};
type StaffOption = { id: string; name: string; role: string };

type CartItem = {
  productId: string;
  productPackageId: string | null;
  name: string;
  sku: string;
  packageLabel: string;
  quantity: number;
  unitPrice: number;
};

// ── Component ─────────────────────────────────────────────────────────────

export default function PayAndClaimPage() {
  // List state
  const [tab, setTab] = useState<"pending" | "reimbursed" | "all">("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [aiExtracted, setAiExtracted] = useState<Record<string, boolean>>({});

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch claims list
  const { data: claims, isLoading, mutate } = useFetch<Claim[]>(
    `/api/inventory/pay-and-claim?tab=${tab}&search=${debouncedSearch}`,
  );

  // Summaries
  const totalAmount = claims?.reduce((s, c) => s + c.totalAmount, 0) ?? 0;
  const pendingAmount = claims?.filter((c) => c.invoice?.status === "PENDING" || c.invoice?.status === "OVERDUE")
    .reduce((s, c) => s + c.totalAmount, 0) ?? 0;
  const reimbursedAmount = claims?.filter((c) => c.invoice?.status === "PAID")
    .reduce((s, c) => s + c.totalAmount, 0) ?? 0;

  // Load options when dialog opens
  const openCreateDialog = async () => {
    setCreateOpen(true);
    setLoadingOptions(true);
    try {
      const [o, s, st] = await Promise.all([
        fetch("/api/settings/outlets?status=ACTIVE").then((r) => r.json()),
        fetch("/api/inventory/suppliers/products").then((r) => r.json()),
        fetch("/api/settings/staff").then((r) => r.json()),
      ]);
      setOutlets(o);
      setSuppliers(s);
      setStaff(Array.isArray(st) ? st : st.staff ?? []);
      if (o.length > 0) setSelectedOutletId(o[0].id);
    } catch { /* ignore */ }
    setLoadingOptions(false);
  };

  const resetCreateDialog = () => {
    setCreateOpen(false);
    setSelectedOutletId("");
    setSelectedSupplierId("");
    setSelectedStaffId("");
    setCart([]);
    setNotes("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setPhotos([]);
    setProductSearch("");
    setAiExtracted({});
  };

  // Cart helpers
  const addToCart = (p: SupplierProduct) => {
    const existing = cart.find((c) => c.productId === p.id && c.productPackageId === (p.packageId || null));
    if (existing) {
      setCart(cart.map((c) =>
        c.productId === p.id && c.productPackageId === (p.packageId || null)
          ? { ...c, quantity: c.quantity + 1 }
          : c,
      ));
    } else {
      setCart([...cart, {
        productId: p.id,
        productPackageId: p.packageId || null,
        name: p.name,
        sku: p.sku,
        packageLabel: p.packageLabel,
        quantity: 1,
        unitPrice: p.price,
      }]);
    }
  };

  const updateCartQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((c, i) => (i === idx ? { ...c, quantity: qty } : c)));
    }
  };

  const updateCartPrice = (idx: number, price: number) => {
    setCart(cart.map((c, i) => (i === idx ? { ...c, unitPrice: price } : c)));
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  // AI extraction from receipt
  const extractReceiptData = async (urls: string[]) => {
    setExtracting(true);
    try {
      const res = await fetch("/api/inventory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, context: "Staff pay & claim receipt. Extract supplier name, total amount, and purchase date." }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const filled: Record<string, boolean> = {};

      // Auto-select supplier if name matches
      if (data.supplierName && !selectedSupplierId) {
        const match = suppliers.find((s) => s.name.toLowerCase().includes(data.supplierName.toLowerCase()) || data.supplierName.toLowerCase().includes(s.name.toLowerCase()));
        if (match) {
          setSelectedSupplierId(match.id);
          filled.supplier = true;
        }
      }

      // Auto-fill purchase date
      if (data.issueDate && purchaseDate === new Date().toISOString().split("T")[0]) {
        setPurchaseDate(data.issueDate);
        filled.purchaseDate = true;
      }

      // Auto-fill notes with supplier name if no supplier match
      if (data.supplierName && !suppliers.find((s) => s.name.toLowerCase().includes(data.supplierName.toLowerCase()))) {
        setNotes((prev) => prev || `Purchased from: ${data.supplierName}`);
        filled.notes = true;
      }

      setAiExtracted((prev) => ({ ...prev, ...filled }));
    } catch { /* silent */ }
    setExtracting(false);
  };

  // Photo upload with AI extraction
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/inventory/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.url);
          setPhotos((prev) => [...prev, data.url]);
        }
      }
    } catch { /* ignore */ }
    setUploading(false);
    e.target.value = "";

    // Trigger AI extraction after first upload batch
    if (newUrls.length > 0 && photos.length === 0) {
      extractReceiptData(newUrls);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedOutletId || !selectedSupplierId || !selectedStaffId || cart.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/pay-and-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutletId,
          supplierId: selectedSupplierId,
          claimedById: selectedStaffId,
          items: cart.map((c) => ({
            productId: c.productId,
            productPackageId: c.productPackageId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
          notes,
          photos,
          purchaseDate,
        }),
      });
      if (res.ok) {
        resetCreateDialog();
        mutate();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  // Mark invoice as paid (reimbursed)
  const handleReimburse = async (invoiceId: string) => {
    await fetch(`/api/inventory/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    mutate();
  };

  // Filtered products for create dialog
  const filteredProducts = selectedSupplierId
    ? (suppliers.find((s) => s.id === selectedSupplierId)?.products ?? []).filter(
        (p) =>
          !productSearch ||
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(productSearch.toLowerCase()),
      )
    : [];

  const TABS = [
    { key: "pending", label: "Pending" },
    { key: "reimbursed", label: "Reimbursed" },
    { key: "all", label: "All" },
  ] as const;

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pay &amp; Claim</h1>
          <p className="mt-0.5 text-sm text-gray-500">Track staff supply purchases and reimbursements</p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" /> New Claim
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500">Total Claims</span>
          </div>
          <p className="text-xl font-bold font-sans">RM {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-gray-500">Pending Reimbursement</span>
          </div>
          <p className="text-xl font-bold font-sans text-amber-600">RM {pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500">Reimbursed</span>
          </div>
          <p className="text-xl font-bold font-sans text-green-600">RM {reimbursedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </Card>
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search claims..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Claims List ── */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : !claims?.length ? (
        <div className="text-center py-12 text-sm text-gray-400">No claims found</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-500 text-left">
                <th className="px-4 py-3 font-medium">Claim #</th>
                <th className="px-4 py-3 font-medium">Outlet</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Paid By</th>
                <th className="px-4 py-3 font-medium text-right">Amount (RM)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((c) => (
                <Fragment key={c.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium">
                      <div className="flex items-center gap-1">
                        <ChevronDown className={`h-3 w-3 transition-transform ${expanded === c.id ? "rotate-180" : ""}`} />
                        {c.orderNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.outlet}</td>
                    <td className="px-4 py-3">{c.supplier}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <UserCircle className="h-3 w-3 text-gray-400" />
                        {c.claimedBy ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">RM {c.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {c.invoice ? (
                        <Badge
                          variant="outline"
                          className={
                            c.invoice.status === "PAID"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : c.invoice.status === "OVERDUE"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {c.invoice.status === "PAID" ? "Reimbursed" : c.invoice.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">No Invoice</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString("en-MY")}</td>
                    <td className="px-4 py-3">
                      {c.invoice && c.invoice.status !== "PAID" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={(e) => { e.stopPropagation(); handleReimburse(c.invoice!.id); }}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Reimburse
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr>
                      <td colSpan={8} className="bg-gray-50 px-6 py-3">
                        <div className="space-y-2">
                          <p className="text-[10px] text-gray-500 uppercase font-medium">Items</p>
                          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-1 text-[11px]">
                            <span className="font-medium text-gray-500">Product</span>
                            <span className="font-medium text-gray-500 text-right">Qty</span>
                            <span className="font-medium text-gray-500 text-right">Price</span>
                            <span className="font-medium text-gray-500 text-right">Total</span>
                            {c.items.map((i) => (
                              <Fragment key={i.id}>
                                <span>{i.product} <span className="text-gray-400">({i.uom})</span></span>
                                <span className="text-right font-mono">{i.quantity}</span>
                                <span className="text-right font-mono">{i.unitPrice.toFixed(2)}</span>
                                <span className="text-right font-mono">{i.totalPrice.toFixed(2)}</span>
                              </Fragment>
                            ))}
                          </div>
                          {c.notes && (
                            <p className="text-[11px] text-gray-500 mt-2">Notes: {c.notes}</p>
                          )}
                          {c.invoice && (
                            <p className="text-[11px] text-gray-500">
                              Invoice: {c.invoice.invoiceNumber}
                              {c.invoice.photoCount > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5">
                                  <ImageIcon className="h-3 w-3" /> {c.invoice.photoCount}
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400">Created by: {c.createdBy}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Claim Dialog ── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateDialog(); }}>
        <DialogContent className="!max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> New Pay &amp; Claim
            </DialogTitle>
          </DialogHeader>

          {loadingOptions ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-5">
              {/* Step 1: Upload Receipt FIRST */}
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-4">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Upload className="h-3.5 w-3.5" /> Step 1: Upload Receipt / Invoice
                </label>
                <p className="mb-3 text-[10px] text-gray-400">Upload first — AI will auto-extract details to fill the form below</p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg border overflow-hidden group">
                      {url.toLowerCase().endsWith(".pdf") || url.includes("/raw/") ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                          <FileText className="h-6 w-6 text-red-400" />
                          <span className="text-[9px] text-gray-400 mt-0.5">PDF</span>
                        </div>
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 gap-1">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-5 w-5 text-gray-400" />}
                    <span className="text-[10px] text-gray-400">{uploading ? "..." : "Upload"}</span>
                    <input type="file" accept="image/*,.pdf" multiple onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>

                {/* AI extraction status */}
                {extracting && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
                    <Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
                    <span className="text-xs text-purple-700">AI is reading the receipt...</span>
                  </div>
                )}
                {Object.keys(aiExtracted).length > 0 && !extracting && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <Sparkles className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-700">AI auto-filled fields below — review and correct if needed</span>
                  </div>
                )}
              </div>

              {/* Step 2: Details (auto-filled by AI, editable) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Outlet *</label>
                  <select
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select outlet</option>
                    {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                    Supplier *
                    {aiExtracted.supplier && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600">AI</span>}
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => { setSelectedSupplierId(e.target.value); setProductSearch(""); }}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Paid By (Staff) *</label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select staff</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                    Purchase Date
                    {aiExtracted.purchaseDate && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600">AI</span>}
                  </label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Product picker */}
              {selectedSupplierId && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Add Products</label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                      {filteredProducts.map((p) => (
                        <button
                          key={`${p.id}-${p.packageId}`}
                          onClick={() => addToCart(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-gray-400 ml-1.5">({p.packageLabel})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 font-mono">RM {p.price.toFixed(2)}</span>
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cart */}
              {cart.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Items ({cart.length})</label>
                  <div className="border rounded-lg divide-y">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.packageLabel}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateCartQty(idx, item.quantity - 1)} className="rounded p-1 hover:bg-gray-100">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateCartQty(idx, parseInt(e.target.value) || 0)}
                            className="w-16 h-8 text-sm text-center"
                          />
                          <button onClick={() => updateCartQty(idx, item.quantity + 1)} className="rounded p-1 hover:bg-gray-100">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">RM</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 text-sm text-right"
                          />
                        </div>
                        <span className="text-sm font-mono w-24 text-right">
                          RM {(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 font-medium text-sm">
                      <span>Total</span>
                      <span className="font-mono">RM {cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                  Notes
                  {aiExtracted.notes && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600">AI</span>}
                </label>
                <Input
                  placeholder="e.g. Bought from nearby store, receipt attached"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`h-9 text-sm ${aiExtracted.notes ? "border-purple-300 bg-purple-50/30" : ""}`}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !selectedOutletId || !selectedSupplierId || !selectedStaffId || cart.length === 0}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Receipt className="mr-1.5 h-4 w-4" />}
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
