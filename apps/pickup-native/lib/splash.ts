import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://order.celsiuscoffee.com";
const CACHE_KEY = "celsius-splash-poster-v1";

export type SplashPoster = {
  id: string;
  imageUrl: string;
  deeplink: string | null;
  durationMs: number;
};

// Try cache first (so cold launches work offline + show instantly),
// then fetch fresh in the background. Returns whatever's available now.
export async function getSplashPoster(): Promise<SplashPoster | null> {
  let cached: SplashPoster | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {
    // ignore
  }

  // Always trigger background refresh so next launch is up-to-date
  refresh().catch(() => {
    // Network failures are fine; cache will be served next time
  });

  return cached;
}

async function refresh() {
  const res = await fetch(`${API_BASE}/api/splash-poster?brand_id=brand-celsius`, {
    headers: {
      "Content-Type": "application/json",
      Origin: API_BASE,
      Referer: API_BASE + "/",
    },
  });
  if (!res.ok) return;
  const json = (await res.json()) as { poster: SplashPoster | null };
  if (json.poster) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json.poster));
  } else {
    await AsyncStorage.removeItem(CACHE_KEY);
  }
}
