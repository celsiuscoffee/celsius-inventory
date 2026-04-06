"use client";

import { useState, useEffect, useRef } from "react";
import { displayRM } from "@/types/database";
import { createQRPayment, checkPaymentStatus, cancelQRPayment, type QRPaymentResult } from "@/lib/qr-payment";

type Props = {
  amount: number; // sen
  orderNumber: string;
  outletName: string;
  onSuccess: (method: string, transactionRef: string) => void;
  onCancel: () => void;
};

export function QRPaymentModal({ amount, orderNumber, outletName, onSuccess, onCancel }: Props) {
  const [qr, setQr] = useState<QRPaymentResult | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "success" | "failed" | "expired">("loading");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [countdown, setCountdown] = useState(300); // 5 min
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create QR on mount
  useEffect(() => {
    async function init() {
      try {
        const result = await createQRPayment({
          amount,
          orderNumber,
          outletName,
        });
        setQr(result);
        setStatus("waiting");
        startPolling(result.checkoutId);
        startCountdown();
      } catch (err) {
        console.error("[QR] Create failed:", err);
        setStatus("failed");
      }
    }
    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startPolling(checkoutId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const result = await checkPaymentStatus(checkoutId);
        if (result.status === "success") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          setStatus("success");
          setPaymentMethod(result.method ?? "QR Payment");
          // Small delay for UX
          setTimeout(() => {
            onSuccess(result.method ?? "QR Payment", result.transactionId ?? checkoutId);
          }, 2000);
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
        } else if (result.status === "expired") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("expired");
        }
      } catch {
        // Polling error — keep trying
      }
    }, 3000); // Poll every 3 seconds
  }

  function startCountdown() {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleCancel() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (qr) cancelQRPayment(qr.checkoutId);
    onCancel();
  }

  function handleRetry() {
    setStatus("loading");
    setCountdown(300);
    createQRPayment({ amount, orderNumber, outletName }).then((result) => {
      setQr(result);
      setStatus("waiting");
      startPolling(result.checkoutId);
      startCountdown();
    });
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-surface-raised shadow-2xl">

        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            <p className="mt-4 text-sm text-text-muted">Generating QR code...</p>
          </div>
        )}

        {/* Waiting for scan */}
        {status === "waiting" && qr && (
          <div className="flex flex-col items-center px-6 py-6">
            {/* Header */}
            <img src="/images/celsius-logo-sm.jpg" alt="Celsius" width={40} height={40} className="rounded-xl" />
            <h3 className="mt-2 text-lg font-bold">Scan to Pay</h3>
            <p className="text-2xl font-bold text-brand">{displayRM(amount)}</p>

            {/* QR Code */}
            <div className="mt-4 rounded-2xl bg-white p-4">
              <img
                src={qr.qrCodeUrl}
                alt="Payment QR Code"
                width={250}
                height={250}
                className="h-[250px] w-[250px]"
              />
            </div>

            {/* Accepted methods */}
            <div className="mt-3 flex items-center gap-2">
              {["DuitNow", "TnG", "GrabPay", "Boost"].map((m) => (
                <span key={m} className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-medium text-text-muted">
                  {m}
                </span>
              ))}
            </div>

            {/* Countdown */}
            <p className="mt-3 text-xs text-text-dim">
              Expires in {mins}:{secs.toString().padStart(2, "0")}
            </p>

            {/* Polling indicator */}
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
              <span className="text-[10px] text-text-dim">Waiting for payment...</span>
            </div>

            {/* Cancel */}
            <button
              onClick={handleCancel}
              className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-text-muted hover:bg-surface-hover"
            >
              Cancel &amp; Choose Other Method
            </button>
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-3 text-xl font-bold">Payment Received</h3>
            <p className="mt-1 text-sm text-text-muted">{displayRM(amount)}</p>
            <span className="mt-2 rounded-full bg-success/20 px-3 py-1 text-xs font-medium text-success">
              {paymentMethod}
            </span>
          </div>
        )}

        {/* Failed */}
        {status === "failed" && (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
              <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="mt-3 text-xl font-bold">Payment Failed</h3>
            <p className="mt-1 text-sm text-text-muted">Please try again</p>
            <div className="mt-4 flex gap-3">
              <button onClick={handleRetry} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                Retry
              </button>
              <button onClick={handleCancel} className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium hover:bg-surface-hover">
                Other Method
              </button>
            </div>
          </div>
        )}

        {/* Expired */}
        {status === "expired" && (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h3 className="mt-3 text-xl font-bold">QR Expired</h3>
            <p className="mt-1 text-sm text-text-muted">Payment was not completed in time</p>
            <div className="mt-4 flex gap-3">
              <button onClick={handleRetry} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                Generate New QR
              </button>
              <button onClick={handleCancel} className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium hover:bg-surface-hover">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
