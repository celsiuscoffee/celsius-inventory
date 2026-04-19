"use client";

import { useFetch } from "@/lib/use-fetch";
import Link from "next/link";
import { ArrowLeft, Star, AlertTriangle, MessageCircle } from "lucide-react";

type MyReview = {
  id: string;
  outletName: string;
  rating: number;
  comment: string | null;
  reviewer: string | null;
  createdAt: string;
  isPenalty: boolean;
  penaltyStatus: string | null;
};

export default function MyReviewsPage() {
  const { data, isLoading } = useFetch<{ reviews: MyReview[]; count: number }>("/api/hr/my-reviews");
  const reviews = data?.reviews || [];

  const positiveCount = reviews.filter((r) => r.rating >= 4).length;
  const negativeCount = reviews.filter((r) => r.rating <= 3).length;

  return (
    <div className="px-4 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/hr"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95 active:bg-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Feedback</h1>
      </div>

      {!isLoading && reviews.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{positiveCount}</p>
            <p className="text-[10px] text-green-700">4★ and above</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{negativeCount}</p>
            <p className="text-[10px] text-red-700">3★ or below</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-gray-50 py-16">
          <MessageCircle className="mb-2 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-gray-500">No reviews yet</p>
          <p className="text-xs text-gray-400">Google reviews during your shifts will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                    />
                  ))}
                </div>
                {r.isPenalty && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Penalty {r.penaltyStatus === "applied" ? "applied" : "pending"}
                  </span>
                )}
                {r.rating >= 4 && (
                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                    Nice!
                  </span>
                )}
              </div>
              {r.comment && <p className="text-sm text-gray-700 italic">&ldquo;{r.comment}&rdquo;</p>}
              <p className="mt-2 text-xs text-gray-500">
                {r.reviewer || "Anonymous"} · {r.outletName} · {new Date(r.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
