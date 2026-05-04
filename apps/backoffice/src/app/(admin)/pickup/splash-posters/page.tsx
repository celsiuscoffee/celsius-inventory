"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ImagePlus,
  Power,
  Clock,
} from "lucide-react";
import { adminFetch } from "@/lib/pickup/admin-fetch";
import { useConfirm, toast } from "@celsius/ui";

type Poster = {
  id: string;
  brand_id: string;
  image_url: string;
  title: string | null;
  deeplink: string | null;
  duration_ms: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

type Form = {
  id: string;
  imageUrl: string;
  title: string;
  deeplink: string;
  durationMs: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const empty: Form = {
  id: "",
  imageUrl: "",
  title: "",
  deeplink: "",
  durationMs: 2500,
  active: false,
  startsAt: "",
  endsAt: "",
};

export default function SplashPostersPage() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(empty);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/pickup/splash-posters");
      const json = await res.json();
      setPosters(json.posters ?? []);
    } catch (e) {
      toast.error("Failed to load posters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(empty);
    setShowForm(true);
  };

  const openEdit = (p: Poster) => {
    setForm({
      id: p.id,
      imageUrl: p.image_url,
      title: p.title ?? "",
      deeplink: p.deeplink ?? "",
      durationMs: p.duration_ms,
      active: p.active,
      startsAt: p.starts_at ?? "",
      endsAt: p.ends_at ?? "",
    });
    setShowForm(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminFetch("/api/pickup/upload-image", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setForm((f) => ({ ...f, imageUrl: json.url }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.imageUrl) {
      toast.error("Image required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        imageUrl: form.imageUrl,
        title: form.title || null,
        deeplink: form.deeplink || null,
        durationMs: form.durationMs,
        active: form.active,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      const url = form.id
        ? `/api/pickup/splash-posters?id=${encodeURIComponent(form.id)}`
        : "/api/pickup/splash-posters";
      const res = await adminFetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(form.id ? "Poster updated" : "Poster created");
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Poster) => {
    try {
      const res = await adminFetch(
        `/api/pickup/splash-posters?id=${encodeURIComponent(p.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !p.active }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      load();
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const del = async (p: Poster) => {
    const ok = await confirm({
      title: "Delete poster?",
      message: "This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(p.id);
    try {
      const res = await adminFetch(
        `/api/pickup/splash-posters?id=${encodeURIComponent(p.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      load();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <ConfirmDialog />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Splash Posters</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Full-screen promo image shown when the pickup app launches. Only one active at a time.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          <Plus className="h-4 w-4" />
          New poster
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : posters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No posters yet.</p>
          <button
            onClick={openNew}
            className="mt-3 text-sm font-medium text-terracotta hover:underline"
          >
            Create your first poster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posters.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="relative aspect-[9/16] bg-gray-100">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={p.title ?? ""}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  {p.active && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {p.title || "(untitled)"}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {p.deeplink ? `Tap → ${p.deeplink}` : "No deeplink"} · {p.duration_ms}ms
                </p>
                {(p.starts_at || p.ends_at) && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {p.starts_at ? new Date(p.starts_at).toLocaleDateString() : "—"} →{" "}
                    {p.ends_at ? new Date(p.ends_at).toLocaleDateString() : "—"}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                      p.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    {p.active ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => del(p)}
                    disabled={deleting === p.id}
                    className="flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 disabled:opacity-50"
                  >
                    {deleting === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit poster" : "New poster"}
              </h3>
              <button onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700">
                  Image (9:16 portrait, ≤8MB)
                </label>
                <div className="mt-1 flex items-start gap-3">
                  {form.imageUrl ? (
                    <div className="relative">
                      <img
                        src={form.imageUrl}
                        alt=""
                        className="h-40 w-24 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow"
                      >
                        <X className="h-3 w-3 text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex h-40 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-terracotta"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5" />
                          <span>Upload</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Title (internal)
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g. Ramadan 2026 promo"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Deeplink (optional, where tap navigates)
                </label>
                <input
                  type="text"
                  value={form.deeplink}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deeplink: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="/menu  or  /product/[id]  or  /rewards"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Show duration ({(form.durationMs / 1000).toFixed(1)}s)
                </label>
                <input
                  type="range"
                  min={1000}
                  max={5000}
                  step={500}
                  value={form.durationMs}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMs: Number(e.target.value) }))
                  }
                  className="mt-1 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Starts at (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startsAt: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Ends at (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endsAt: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Active (show in app)
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !form.imageUrl}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.id ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
