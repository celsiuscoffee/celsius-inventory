"use client";

import { useState, useEffect } from "react";
import { Star, Loader2, Check, ChevronRight } from "lucide-react";
import { use } from "react";

// ─── Types ─────────────────────────────────────────────────

type ReviewSettings = {
  ratingThreshold: number;
  googleReviewUrl: string | null;
  heading: string | null;
  description: string | null;
  logoUrl: string | null;
  feedbackFields: { question: string; type: string; required: boolean; active: boolean }[];
};

type OutletInfo = { name: string };

type Step = "rating" | "feedback" | "thanks" | "redirect";

// ─── Star Button ───────────────────────────────────────────

function StarButton({
  rating,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  rating: number;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const labels = ["", "Terrible", "Poor", "Average", "Good", "Great"];
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className="flex flex-col items-center gap-1 transition-transform active:scale-95"
    >
      <div className={`rounded-xl border-2 px-4 py-3 transition-colors ${
        selected || hovered
          ? "border-amber-400 bg-amber-50"
          : "border-gray-200 bg-white hover:border-amber-200"
      }`}>
        <div className="flex gap-0.5">
          {Array.from({ length: rating }, (_, i) => (
            <Star
              key={i}
              className={`h-6 w-6 ${selected || hovered ? "fill-amber-400 text-amber-400" : "fill-gray-300 text-gray-300"}`}
            />
          ))}
        </div>
      </div>
      <span className={`text-xs font-medium ${selected ? "text-amber-600" : "text-gray-400"}`}>
        {labels[rating]}
      </span>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function PublicReviewPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const [step, setStep] = useState<Step>("rating");
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [settings, setSettings] = useState<ReviewSettings | null>(null);
  const [outlet, setOutlet] = useState<OutletInfo | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch settings
  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, outletRes] = await Promise.all([
          fetch(`/api/reviews/settings?outletId=${outletId}`),
          fetch(`/api/settings/outlets`),
        ]);
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
        }
        if (outletRes.ok) {
          const outlets = await outletRes.json();
          const o = outlets.find((x: { id: string }) => x.id === outletId);
          if (o) setOutlet({ name: o.name });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [outletId]);

  const handleRatingSelect = (rating: number) => {
    setSelectedRating(rating);
    const threshold = settings?.ratingThreshold ?? 4;

    if (rating >= threshold) {
      // High rating → redirect to Google
      setStep("redirect");
      setTimeout(() => {
        if (settings?.googleReviewUrl) {
          window.location.href = settings.googleReviewUrl;
        } else {
          setStep("thanks");
        }
      }, 1500);
    } else {
      // Low rating → show feedback form
      setStep("feedback");
    }
  };

  const handleSubmitFeedback = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/reviews/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          rating: selectedRating,
          name: formData["Name"] || null,
          phone: formData["Phone"] || null,
          feedback: formData["Feedback"] || null,
        }),
      });
      setStep("thanks");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeFields = (settings?.feedbackFields ?? []).filter((f) => f.active);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="" className="mx-auto mb-6 h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100 text-2xl font-bold text-amber-600">
            {outlet?.name?.slice(0, 1) || "C"}
          </div>
        )}

        {/* Rating step */}
        {step === "rating" && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">
              {settings?.heading || "How would you rate your experience?"}
            </h1>
            {settings?.description && (
              <p className="mt-2 text-sm text-gray-500">{settings.description}</p>
            )}
            {outlet && <p className="mt-1 text-xs text-gray-400">{outlet.name}</p>}

            <div className="mt-8 flex flex-col gap-3">
              {[5, 4, 3, 2, 1].map((rating) => (
                <StarButton
                  key={rating}
                  rating={rating}
                  selected={selectedRating === rating}
                  hovered={hoveredRating === rating}
                  onSelect={() => handleRatingSelect(rating)}
                  onHover={() => setHoveredRating(rating)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Redirect step */}
        {step === "redirect" && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">Thank you!</h2>
            <p className="mt-2 text-sm text-gray-500">
              Redirecting you to leave a Google review...
            </p>
            <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {/* Feedback form step */}
        {step === "feedback" && (
          <div>
            <h2 className="text-center text-lg font-bold text-gray-900">We&apos;d love your feedback</h2>
            <p className="mt-1 text-center text-sm text-gray-500">
              Help us improve your experience
            </p>

            <div className="mt-2 flex justify-center">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i <= selectedRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {activeFields.map((field) => (
                <div key={field.question}>
                  <label className="text-sm font-medium text-gray-700">
                    {field.question}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.type === "paragraph" ? (
                    <textarea
                      value={formData[field.question] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.question]: e.target.value })}
                      placeholder={`Enter ${field.question.toLowerCase()}...`}
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
                    />
                  ) : (
                    <input
                      type={field.type === "phone" ? "tel" : "text"}
                      value={formData[field.question] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.question]: e.target.value })}
                      placeholder={field.type === "phone" ? "0123456789" : `Enter ${field.question.toLowerCase()}`}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmitFeedback}
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit feedback
            </button>
          </div>
        )}

        {/* Thanks step */}
        {step === "thanks" && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">Thank you for your feedback!</h2>
            <p className="mt-2 text-sm text-gray-500">
              We appreciate you taking the time to share your experience with us.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
