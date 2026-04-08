"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Save, Send } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import Link from "next/link";

type Category = { id: string; name: string };
type StepInput = { title: string; description: string };

export default function NewSopPage() {
  const router = useRouter();
  const { data: categories } = useFetch<Category[]>("/api/sop-categories");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [steps, setSteps] = useState<StepInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addStep = () => setSteps([...steps, { title: "", description: "" }]);

  const updateStep = (index: number, field: keyof StepInput, value: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSteps(updated);
  };

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
    if (!title.trim()) { setError("Title is required"); return; }
    if (!categoryId) { setError("Category is required"); return; }

    setSaving(true);
    setError("");

    try {
      // Create the SOP
      const sopRes = await fetch("/api/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          content: content.trim() || undefined,
          status,
        }),
      });
      const sopData = await sopRes.json();
      if (!sopRes.ok) { setError(sopData.error || "Failed to create SOP"); return; }

      // Save steps if any
      if (steps.length > 0) {
        const validSteps = steps.filter((s) => s.title.trim());
        if (validSteps.length > 0) {
          await fetch(`/api/sops/${sopData.id}/steps`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              steps: validSteps.map((s, i) => ({
                stepNumber: i + 1,
                title: s.title.trim(),
                description: s.description.trim() || undefined,
              })),
            }),
          });
        }
      }

      router.push(`/sops/${sopData.id}`);
    } catch {
      setError("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link href="/sops" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" />Back to SOPs
        </Link>
        <h1 className="text-xl font-bold text-foreground">Create SOP</h1>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Basic Info */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Morning Opening Checklist"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this SOP"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a category</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Content / Notes</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detailed instructions, guidelines, or notes for this SOP..."
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              />
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-foreground">Steps</h2>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No steps yet. Add steps to break down this SOP into actionable items.
              </p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-2 rounded-lg border border-border p-3">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-terracotta/10 text-xs font-medium text-terracotta">
                        {index + 1}
                      </span>
                      <button
                        onClick={() => moveStep(index, index - 1)}
                        disabled={index === 0}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move up"
                      >
                        <GripVertical className="h-3.5 w-3.5 rotate-90" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={step.title}
                        onChange={(e) => updateStep(index, "title", e.target.value)}
                        placeholder="Step title"
                        className="text-sm"
                      />
                      <textarea
                        value={step.description}
                        onChange={(e) => updateStep(index, "description", e.target.value)}
                        placeholder="Step details (optional)"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs resize-y"
                      />
                    </div>
                    <button
                      onClick={() => removeStep(index)}
                      className="self-start rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error & Actions */}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => handleSubmit("DRAFT")}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit("PUBLISHED")}
            disabled={saving}
            className="bg-terracotta hover:bg-terracotta-dark"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
