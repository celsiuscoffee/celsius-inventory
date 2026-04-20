import { hrSupabaseAdmin } from "./supabase";

/**
 * Resolve the set of user_ids a session is allowed to see in HR views.
 *
 * - OWNER / ADMIN: returns null (no scoping — caller should treat as "everyone").
 * - MANAGER: returns the manager's full subtree — direct reports AND
 *   reports-of-reports, walked transitively via `hr_employee_profiles.manager_user_id`.
 *   A manager always sees their entire downstream org, not just level 1.
 *
 * The result does NOT include the session user themselves.
 */
export async function resolveVisibleUserIds(
  session: { role: string; id: string },
): Promise<string[] | null> {
  if (session.role !== "MANAGER") return null;

  const { data: profiles } = await hrSupabaseAdmin
    .from("hr_employee_profiles")
    .select("user_id, manager_user_id");

  const childrenByManager = new Map<string, string[]>();
  for (const p of (profiles || []) as { user_id: string; manager_user_id: string | null }[]) {
    if (!p.manager_user_id) continue;
    const list = childrenByManager.get(p.manager_user_id);
    if (list) list.push(p.user_id);
    else childrenByManager.set(p.manager_user_id, [p.user_id]);
  }

  const visited = new Set<string>();
  const queue: string[] = [session.id];
  while (queue.length) {
    const mgr = queue.shift()!;
    for (const child of childrenByManager.get(mgr) || []) {
      if (visited.has(child)) continue; // cycle guard
      visited.add(child);
      queue.push(child);
    }
  }
  return Array.from(visited);
}
