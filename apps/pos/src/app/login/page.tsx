"use client";

import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleDigit(digit: string) {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) handleLogin(newPin);
    }
  }

  function handleDelete() { setPin(pin.slice(0, -1)); setError(""); }
  function handleClear() { setPin(""); setError(""); }

  async function handleLogin(code: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (res.ok) {
        const staff = await res.json();
        sessionStorage.setItem("pos_staff", JSON.stringify(staff));
        window.location.href = "/register";
        return;
      }

      const data = await res.json().catch(() => ({ error: "Login error" }));
      setError(data.error || "Invalid PIN");
      setTimeout(() => { setPin(""); setError(""); }, 1000);
    } catch {
      setError("Login error");
      setTimeout(() => { setPin(""); setError(""); }, 1000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pos-screen flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <Image src="/images/celsius-logo-sm.jpg" alt="Celsius Coffee" width={100} height={100} className="rounded-2xl" priority />
          <Image src="/images/celsius-wordmark-white.png" alt="Celsius Coffee" width={220} height={48} className="opacity-90" priority />
          <p className="text-lg text-text-muted">Enter your 6-digit PIN</p>
        </div>

        <div className="flex gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-5 w-5 rounded-full transition-all duration-200 ${
              i < pin.length ? (error ? "scale-125 bg-danger" : "scale-125 bg-brand") : "bg-[#444]"
            }`} />
          ))}
        </div>

        <div className="h-6">
          {error && <p className="text-lg font-medium text-danger">{error}</p>}
          {loading && <p className="text-lg text-text-muted">Verifying...</p>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} onClick={() => handleDigit(d)} disabled={loading}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-raised text-3xl font-medium text-text transition-colors hover:bg-surface-hover active:bg-border-light disabled:opacity-50">
              {d}
            </button>
          ))}
          <button onClick={handleClear} className="flex h-20 w-20 items-center justify-center rounded-2xl bg-danger/20 text-base font-medium text-danger hover:bg-danger/30">Clear</button>
          <button onClick={() => handleDigit("0")} disabled={loading}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-raised text-3xl font-medium text-text hover:bg-surface-hover disabled:opacity-50">0</button>
          <button onClick={handleDelete}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-raised text-2xl text-text hover:bg-surface-hover">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
