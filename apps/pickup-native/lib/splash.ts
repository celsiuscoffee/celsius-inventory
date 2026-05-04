import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://order.celsiuscoffee.com";
const CACHE_KEY = "celsius-splash-poster-v1";

export type SplashPoster = {
  id: string;
  imageUrl: string;
  deeplink: string | null;
  durationMs: number;
};

// Cold-launch flow:
//   - if we have a cached poster, return it immediately AND refresh in
//     background (so next launch picks up changes)
//   - if cache is empty, wait for the network fetch (up to 2s) so the
//     splash poster appears on first launch too. After 2s, give up
//     and return null (don't block the app launch indefinitely).
export async function getSplashPoster(): Promise<SplashPoster | null> {
  let cached: SplashPoster | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (cached) {
    fetchPoster().catch(() => {});
    return cached;
  }

  // No cache — race a fresh fetch against a 2s timeout so we don't
  // block the app launch forever on a flaky network.
  return Promise.race<SplashPoster | null>([
    fetchPoster(),
    new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
  ]);
}

async function fetchPoster(): Promise<SplashPoster | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/splash-poster?brand_id=brand-celsius`,
      {
        headers: {
          "Content-Type": "application/json",
          Origin: API_BASE,
          Referer: API_BASE + "/",
        },
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { poster: SplashPoster | null };
    if (json.poster) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json.poster)).catch(
        () => {}
      );
    } else {
      await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    }
    return json.poster;
  } catch {
    return null;
  }
}
