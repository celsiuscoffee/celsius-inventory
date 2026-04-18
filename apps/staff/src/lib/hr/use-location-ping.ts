"use client";

import { useEffect, useRef, useState } from "react";

export type PingStatus = "idle" | "ok" | "out_of_zone" | "warning" | "auto_close_pending";

type PingResponse = {
  attendanceLogId: string;
  inZone: boolean;
  distance: number | null;
  radius: number;
  zoneName: string | null;
  outOfZoneMinutes: number;
  thresholds: { warn: number; grace: number };
  status: "ok" | "out_of_zone" | "warning" | "auto_close_pending";
  notClockedIn?: boolean;
};

// Sends a location heartbeat every intervalMs (default 60s) while:
// - tab is visible
// - user is clocked in (caller gates this via `enabled`)
// Returns the latest status so the UI can render warnings.
export function useLocationPing(opts: { enabled: boolean; intervalMs?: number }) {
  const { enabled, intervalMs = 60_000 } = opts;
  const [state, setState] = useState<{
    status: PingStatus;
    distance: number | null;
    zoneName: string | null;
    outOfZoneMinutes: number;
    grace: number;
    warn: number;
    lastPingAt: Date | null;
    error: string | null;
  }>({
    status: "idle",
    distance: null,
    zoneName: null,
    outOfZoneMinutes: 0,
    grace: 30,
    warn: 20,
    lastPingAt: null,
    error: null,
  });

  const sendingRef = useRef(false);

  async function sendPing(source: "foreground" | "push_wake" = "foreground") {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      // Get current position
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 15_000,
        });
      });

      // Attempt to read battery (optional, not all browsers)
      let batteryLevel: number | undefined;
      try {
        const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
        if (typeof nav.getBattery === "function") {
          const b = await nav.getBattery();
          batteryLevel = Math.round(b.level * 100);
        }
      } catch { /* ignore */ }

      const res = await fetch("/api/hr/attendance/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          batteryLevel,
          source,
        }),
      });
      const data: PingResponse = await res.json();
      if (data.notClockedIn) {
        setState((s) => ({ ...s, status: "idle", lastPingAt: new Date() }));
        return;
      }
      setState({
        status: data.status,
        distance: data.distance,
        zoneName: data.zoneName,
        outOfZoneMinutes: data.outOfZoneMinutes,
        grace: data.thresholds.grace,
        warn: data.thresholds.warn,
        lastPingAt: new Date(),
        error: null,
      });
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : "ping failed" }));
    } finally {
      sendingRef.current = false;
    }
  }

  useEffect(() => {
    if (!enabled) return;
    // Send immediately on mount
    sendPing();

    const interval = window.setInterval(() => {
      if (!document.hidden) sendPing();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (!document.hidden) sendPing();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);

  return state;
}
