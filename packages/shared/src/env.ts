/**
 * Env var schema validation.
 *
 * Usage:
 *   import { z } from "zod";
 *   import { parseEnv } from "@celsius/shared";
 *
 *   export const env = parseEnv(
 *     z.object({
 *       DATABASE_URL: z.string().url(),
 *       JWT_SECRET: z.string().min(32),
 *     }),
 *   );
 *
 * Fails fast on import with a readable error listing every missing / invalid
 * variable. Use at app startup (e.g. in a top-level `env.ts` module) so a bad
 * deploy crashes before serving traffic.
 */
import type { ZodType, z } from "zod";

export class EnvValidationError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(
      `Environment validation failed:\n` +
        issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

export function parseEnv<T extends ZodType>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
  throw new EnvValidationError(issues);
}
