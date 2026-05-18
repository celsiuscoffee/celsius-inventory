/**
 * Indeed Employer API client (Sponsored Jobs).
 *
 * Uses OAuth 2.0 client_credentials (2-legged) — no user interaction.
 * Access tokens are short-lived (~1h) and cached in process memory.
 *
 * Env vars required (Vercel):
 *   INDEED_CLIENT_ID
 *   INDEED_CLIENT_SECRET
 *
 * App: "Celsius Backoffice" registered 2026-05-18 at
 *   https://secure.indeed.com/account/apikeys
 */

const TOKEN_URL = "https://apis.indeed.com/oauth/v2/tokens";
const API_BASE  = "https://apis.indeed.com";

// Scope required for Sponsored Jobs API reporting endpoints.
const SCOPE = "employer_access employer.advertising.account.read employer.advertising.campaign.read employer.advertising.campaign_report.read";

type CachedToken = { accessToken: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

async function fetchAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const { INDEED_CLIENT_ID, INDEED_CLIENT_SECRET } = process.env;
  if (!INDEED_CLIENT_ID || !INDEED_CLIENT_SECRET) {
    throw new Error("Indeed OAuth credentials missing: set INDEED_CLIENT_ID and INDEED_CLIENT_SECRET");
  }

  const basicAuth = Buffer.from(`${INDEED_CLIENT_ID}:${INDEED_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type":  "application/x-www-form-urlencoded",
      "Accept":        "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Indeed token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt:   now + data.expires_in * 1000,
  };
  return data.access_token;
}

/**
 * Call any Sponsored Jobs API endpoint with a fresh OAuth bearer token.
 * `path` is the path-portion of the URL (e.g. "/v1/campaigns").
 */
export async function indeedFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = await fetchAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Indeed API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Reset token cache (for tests). */
export function resetIndeedTokenCache(): void {
  cachedToken = null;
}
