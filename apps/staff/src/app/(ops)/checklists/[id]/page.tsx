"use client";

import { useState, useRef, use } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, MessageSquare, Clock,
  Camera, X, Image as ImageIcon,
} from "lucide-react";
import { useFetch } from "@/lib/use-fetch";

/* eslint-disable @next/next/no-img-element */

type ChecklistItem = {
  id: string;
  stepNumber: number;
  title: string;
  description: string | null;
  photoRequired: boolean;
  isCompleted: boolean;
  completedBy: { id: string; name: string } | null;
  completedAt: string | null;
  notes: string | null;
  photoUrl: string | null;
};

type ChecklistDetail = {
  id: string;
  date: string;
  shift: "OPENING" | "MIDDAY" | "CLOSING";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  sop: { id: string; title: string; description: string | null; content: string | null; category: { name: string } };
  outlet: { id: string; code: string; name: string };
  assignedTo: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  completedAt: string | null;
  notes: string | null;
  items: ChecklistItem[];
};

const SHIFT_LABELS: Record<string, string> = { OPENING: "Opening", MIDDAY: "Midday", CLOSING: "Closing" };
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export default function ChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: checklist, isLoading, mutate } = useFetch<ChecklistDetail>(`/api/checklists/${id}`);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<string | null>(null);

  const toggleItem = async (item: ChecklistItem) => {
    if (!item.isCompleted && item.photoRequired && !item.photoUrl) {
      alert("Photo is required for this step. Please take a photo first.");
      handlePhotoClick(item.id);
      return;
    }
    setTogglingItem(item.id);
    try {
      const res = await fetch(`/api/checklists/${id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed"); }
      mutate();
    } finally {
      setTogglingItem(null);
    }
  };

  const saveNote = async (itemId: string) => {
    await fetch(`/api/checklists/${id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: noteText }),
    });
    setNotesOpen(null);
    setNoteText("");
    mutate();
  };

  const handlePhotoClick = (itemId: string) => {
    activeItemRef.current = itemId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = activeItemRef.current;
    if (!file || !itemId) return;

    // Reset input
    e.target.value = "";

    setUploadingItem(itemId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { alert(uploadData.error || "Upload failed"); return; }

      // Save photo URL to checklist item
      await fetch(`/api/checklists/${id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: uploadData.url }),
      });
      mutate();
    } finally {
      setUploadingItem(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Checklist not found</p>
        <Link href="/checklists" className="mt-2 text-sm text-terracotta hover:underline">Back</Link>
      </div>
    );
  }

  const completedCount = checklist.items.filter((i) => i.isCompleted).length;
  const totalCount = checklist.items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo preview modal */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPhotoPreview(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setPhotoPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={photoPreview} alt="Photo proof" className="max-h-[80vh] max-w-[90vw] rounded-lg" />
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <Link href="/checklists" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" />Back to Checklists
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">{checklist.sop.title}</h1>
          <Badge className={STATUS_COLORS[checklist.status]}>{checklist.status.replace("_", " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {checklist.outlet.name} · {SHIFT_LABELS[checklist.shift]} shift · {checklist.sop.category.name}
          {checklist.assignedTo && ` · Assigned to ${checklist.assignedTo.name}`}
        </p>
      </div>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-bold">{completedCount}/{totalCount} items · {progress}%</span>
          </div>
          <div className="rounded-full bg-muted h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                checklist.status === "COMPLETED" ? "bg-green-500" : "bg-terracotta"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {checklist.status === "COMPLETED" && checklist.completedBy && (
            <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed by {checklist.completedBy.name}
              {checklist.completedAt && ` at ${new Date(checklist.completedAt).toLocaleTimeString()}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* SOP Content */}
      {checklist.sop.content && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Guidelines</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{checklist.sop.content}</p>
          </CardContent>
        </Card>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklist.items.map((item) => (
          <Card key={item.id} className={`transition-all ${item.isCompleted ? "opacity-75" : ""}`}>
            <CardContent className="p-0">
              <div className="flex items-start gap-3 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleItem(item)}
                  disabled={togglingItem === item.id}
                  className="mt-0.5 shrink-0"
                >
                  {togglingItem === item.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : item.isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-terracotta transition-colors" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-terracotta/60">#{item.stepNumber}</span>
                    <h4 className={`text-sm font-medium ${item.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.title}
                    </h4>
                    {item.photoRequired && !item.photoUrl && (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">
                        <Camera className="h-2.5 w-2.5" />Required
                      </span>
                    )}
                    {item.photoRequired && item.photoUrl && (
                      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
                        <Camera className="h-2.5 w-2.5" />Done
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  )}
                  {item.isCompleted && item.completedBy && (
                    <p className="mt-1 text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.completedBy.name}
                      {item.completedAt && ` · ${new Date(item.completedAt).toLocaleTimeString()}`}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                      {item.notes}
                    </p>
                  )}
                  {/* Photo thumbnail */}
                  {item.photoUrl && (
                    <button onClick={() => setPhotoPreview(item.photoUrl)} className="mt-2">
                      <img
                        src={item.photoUrl}
                        alt="Photo proof"
                        className="h-16 w-16 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity"
                      />
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handlePhotoClick(item.id)}
                    disabled={uploadingItem === item.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Take photo"
                  >
                    {uploadingItem === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : item.photoUrl ? (
                      <ImageIcon className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setNotesOpen(notesOpen === item.id ? null : item.id);
                      setNoteText(item.notes ?? "");
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Add note"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Notes input */}
              {notesOpen === item.id && (
                <div className="border-t border-border px-4 py-3 bg-muted/30">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs resize-none"
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setNotesOpen(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => saveNote(item.id)} className="bg-terracotta hover:bg-terracotta-dark">
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
