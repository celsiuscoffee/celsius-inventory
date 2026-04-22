import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const BASE_URL = process.env.SHORTLINK_BASE_URL || "https://payment.celsiuscoffee.com";

/**
 * Create a short link. The optional `slug` is appended as a decorative
 * trailing segment so the shared URL reads like
 * `payment.celsiuscoffee.com/r/f1bb4eff/POP_26-0374_Blancoz_RM240.00.pdf`
 * instead of just `/r/f1bb4eff`. Resolution only uses the first segment (the
 * 8-char hex id); the slug is ignored by the route handler, so stale slugs
 * still resolve to the right file (GitHub-gist pattern).
 */
export async function createShortLink(url: string, slug?: string): Promise<string> {
  const id = randomBytes(4).toString("hex"); // 8-char hex
  await prisma.shortLink.create({ data: { id, url } });
  const suffix = slug ? `/${encodeURIComponent(slug)}` : "";
  return `${BASE_URL}/r/${id}${suffix}`;
}
