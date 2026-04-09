/**
 * Edge-compatible auth helpers — only JWT verification via jose.
 * Used by middleware.ts (Edge Runtime). No Node.js crypto or bcrypt.
 */

import { jwtVerify } from "jose";

export const COOKIE_NAME = "celsius-session";
const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  outletId: string | null;
  outletName?: string | null;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("[auth] JWT_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}
