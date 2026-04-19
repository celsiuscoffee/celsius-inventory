/**
 * Typed helpers for `User.moduleAccess` (stored as JSON on the User row).
 *
 * Canonical shape:
 *   { [app: string]: true | string[] }
 *
 * `true` grants the whole app; an array grants specific modules.
 * Legacy shape (flat `string[]`) is still accepted for backwards compatibility
 * and read as a list of already-flattened "app:module" keys.
 */
import { z } from "zod";

// Written with `.catchall()` so the schema is identical under zod v3 and v4
// (the v4 `z.record(keySchema, valueSchema)` form is not backwards-compatible).
export const moduleAccessSchema = z
  .object({})
  .catchall(z.union([z.literal(true), z.array(z.string())]));

export type ModuleAccess = Record<string, true | string[]>;

/**
 * Parse a raw JSON value from the DB into a ModuleAccess object.
 * Returns {} for null, empty, invalid, or legacy-array values.
 */
export function parseModuleAccess(raw: unknown): ModuleAccess {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ModuleAccess = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) {
      out[k] = true;
    } else if (Array.isArray(v) && v.every((x): x is string => typeof x === "string")) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Check if a module access map grants `key`.
 *
 * Key forms:
 *   "app"         → true if the whole app is granted or has any modules
 *   "app:module"  → true if the whole app is granted or the module is listed
 *
 * OWNER / ADMIN roles bypass and are always granted — pass the role in to
 * short-circuit.
 */
export function hasModule(
  role: string,
  access: unknown,
  key: string,
): boolean {
  if (role === "OWNER" || role === "ADMIN") return true;
  const parsed = parseModuleAccess(access);

  if (key.includes(":")) {
    const [app, mod] = key.split(":", 2);
    const entry = parsed[app];
    if (entry === true) return true;
    return Array.isArray(entry) && entry.includes(mod);
  }

  const entry = parsed[key];
  if (entry === true) return true;
  return Array.isArray(entry) && entry.length > 0;
}

/**
 * Flatten `{ settings: ["outlets"], inventory: true }` into
 * `["settings:outlets", "inventory"]` — useful for client-side permission lists.
 */
export function flattenModuleAccess(raw: unknown): string[] {
  const parsed = parseModuleAccess(raw);
  const out: string[] = [];
  for (const [app, entry] of Object.entries(parsed)) {
    if (entry === true) out.push(app);
    else for (const mod of entry) out.push(`${app}:${mod}`);
  }
  return out;
}
