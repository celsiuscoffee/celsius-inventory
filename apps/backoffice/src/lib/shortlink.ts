import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const BASE_URL = process.env.SHORTLINK_BASE_URL || "https://payment.celsiuscoffee.com";

export async function createShortLink(url: string): Promise<string> {
  const id = randomBytes(4).toString("hex"); // 8-char hex
  await prisma.shortLink.create({ data: { id, url } });
  return `${BASE_URL}/r/${id}`;
}
