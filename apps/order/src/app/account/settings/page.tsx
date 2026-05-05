"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useCartStore } from "@/store/cart";

export default function SettingsPage() {
  const router = useRouter();
  const loyaltyMember = useCartStore((s) => s.loyaltyMember);
  const setLoyaltyMember = useCartStore((s) => s.setLoyaltyMember);

  const [showDelete, setShowDelete] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!loyaltyMember) {
    return (
      <div className="flex flex-col min-h-dvh bg-[#f5f5f5]">
        <header className="bg-white px-4 pt-12 pb-3 flex items-center gap-3 sticky top-0 z-10 border-b">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold flex-1 text-center">Settings</h1>
          <div className="w-7" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <p className="text-sm text-muted-foreground">
            Sign in to manage your account.
          </p>
          <button
            onClick={() => router.push("/account")}
            className="mt-4 bg-[#160800] text-white rounded-full px-6 py-3 text-sm font-semibold"
          >
            Go to Account
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  async function handleDelete() {
    if (!loyaltyMember) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/members/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: loyaltyMember.id,
          phone: loyaltyMember.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete account");
        setSubmitting(false);
        return;
      }
      setLoyaltyMember(null);
      setDone(true);
      setTimeout(() => router.push("/"), 2500);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#f5f5f5]">
      <header className="bg-white px-4 pt-12 pb-3 flex items-center gap-3 sticky top-0 z-10 border-b">
        <button onClick={() => router.back()} className="p-1" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold flex-1 text-center">Settings</h1>
        <div className="w-7" />
      </header>

      <main className="flex-1 px-4 py-6 pb-24 space-y-6">
        <section>
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide px-2 mb-2">
            Account
          </h2>
          <div className="bg-white rounded-2xl divide-y">
            <button
              onClick={() => setShowDelete(true)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-600">
                  Delete my account
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Permanently remove your account and all associated data
                </div>
              </div>
            </button>
          </div>
        </section>
      </main>

      {showDelete && !done && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !submitting && setShowDelete(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#160800]">
                  Delete your account?
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <ul className="text-xs text-gray-700 space-y-1.5 mb-4 pl-1">
              <li>• Your name, phone, email, and birthday will be deleted</li>
              <li>
                • Your <strong>{loyaltyMember.pointsBalance ?? 0} points</strong>{" "}
                will be forfeited
              </li>
              <li>• Your full order and rewards history will be removed</li>
              <li>• Push notification tokens will be revoked</li>
            </ul>

            <label className="flex items-start gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
                disabled={submitting}
              />
              <span className="text-xs text-gray-700">
                I understand this is permanent and my points will be forfeited.
              </span>
            </label>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDelete(false);
                  setAcknowledged(false);
                  setError(null);
                }}
                disabled={submitting}
                className="flex-1 bg-gray-100 text-[#160800] rounded-full py-3 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!acknowledged || submitting}
                className="flex-1 bg-red-600 text-white rounded-full py-3 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <h3 className="font-semibold text-[#160800] mb-2">
              Account deleted
            </h3>
            <p className="text-sm text-muted-foreground">
              Your account and personal data have been permanently removed.
              Thank you for being a Celsius customer.
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
