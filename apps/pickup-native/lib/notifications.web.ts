// Web-push counterpart of lib/notifications.ts. Subscribes the browser
// to push notifications via the service worker and posts the
// PushSubscription to the existing /api/push/subscribe endpoint that
// already powers order.celsiuscoffee.com.
//
// Same exported surface as the native module so call-sites don't have
// to branch on Platform.OS — Metro picks `.web.ts` automatically.

const API_BASE = "https://order.celsiuscoffee.com";
const STORED_ENDPOINT_KEY = "celsius-web-push-endpoint-v1";

// EXPO_PUBLIC_VAPID_PUBLIC_KEY is mirrored from the server's
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (apps/order/.env.local). Set in Vercel
// env for the apps/order project so the Expo Web bundle picks it up at
// export time.
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type RegisterCtx = {
  phone?: string | null;
  memberId?: string | null;
};

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer as ArrayBuffer;
}

function isBrowserPushReady(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerForPush(ctx: RegisterCtx): Promise<string | null> {
  if (!isBrowserPushReady()) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] EXPO_PUBLIC_VAPID_PUBLIC_KEY not set; skipping web push");
    return null;
  }

  // Permission — silent if already granted, prompt only on `default`.
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return null;
    }
  }
  if (perm !== "granted") return null;

  // Wait for the SW (registered by the inline script in dist/index.html).
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.warn("[push] subscribe failed:", err);
      return null;
    }
  }

  // Cache: avoid re-posting the same (endpoint, phone) tuple. Mirrors
  // the native behaviour in lib/notifications.ts.
  const fingerprint = `${sub.endpoint}::${ctx.phone ?? ""}`;
  const cached = (() => {
    try {
      return localStorage.getItem(STORED_ENDPOINT_KEY);
    } catch {
      return null;
    }
  })();
  if (cached === fingerprint) return sub.endpoint;

  try {
    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Origin: API_BASE,
        Referer: API_BASE + "/",
      },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        phone: ctx.phone ?? null,
        memberId: ctx.memberId ?? null,
      }),
    });
    if (res.ok) {
      try {
        localStorage.setItem(STORED_ENDPOINT_KEY, fingerprint);
      } catch {}
    }
  } catch (err) {
    console.warn("[push] subscribe POST failed:", err);
  }

  return sub.endpoint;
}

export async function deregisterPush(): Promise<void> {
  if (!isBrowserPushReady()) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await sub.unsubscribe().catch(() => {});
  }
  try {
    localStorage.removeItem(STORED_ENDPOINT_KEY);
  } catch {}
}

export async function trackNotificationOpen(_args: {
  data: { type?: string } | undefined;
  memberId: string | null;
}): Promise<void> {
  // SW already POSTs /api/push/track-open in its `notificationclick`
  // handler — no work to do from React land.
}
