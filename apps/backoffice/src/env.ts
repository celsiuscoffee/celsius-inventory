/**
 * Startup env-var validation for the backoffice app.
 *
 * Imported from `instrumentation.ts` so missing / malformed env crashes
 * the server at boot instead of erroring cryptically on first request.
 *
 * Public (NEXT_PUBLIC_*) vars go through the same schema but are inlined
 * by Next.js at build time, so their validation runs during `next build`
 * as well as at runtime startup.
 */
import { z } from "zod";
import { parseEnv } from "@celsius/shared";

const schema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  // Auth (shared across .celsiuscoffee.com subdomains)
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  AUTH_COOKIE_DOMAIN: z.string().optional(),

  // Supabase (backoffice talks to both the main project and the loyalty project)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_LOYALTY_SUPABASE_URL: z.string().url().optional(),
  LOYALTY_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Telegram (inventory POP matcher)
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  TELEGRAM_OWNER_CHAT_ID: z.string().optional(),

  // AI (Claude)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // Image uploads
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  // Vercel cron jobs
  CRON_SECRET: z.string().min(1).optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export const env = parseEnv(schema);
