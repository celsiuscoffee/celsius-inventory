import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Audience evaluator for custom push campaigns.
 *
 * Takes a JSON rule tree authored in the backoffice rule builder and
 * resolves it to a list of member_ids that match. The cron's
 * runCustomCampaigns branch loops the result and dispatches via
 * dispatchCampaignWithTemplate.
 *
 * Why a bespoke evaluator instead of compiling to one big SQL query:
 *   - Some predicates need cross-table joins (last order date,
 *     active vouchers count) that don't fit a single member_brands
 *     scan cleanly.
 *   - We want to surface a clear error per unsupported field rather
 *     than a generic SQL error if an admin adds a typo'd field.
 *   - The rule shape is small (typically 1-3 conditions) so doing
 *     two-three indexed queries and intersecting in memory is well
 *     within the cron's time budget.
 *
 * The supported field surface is the contract with the backoffice
 * rule builder. To add a new field:
 *   1. Add to FIELD_DEFS below + the resolver.
 *   2. Add the matching entry to AUDIENCE_FIELD_DEFS in the rule
 *      builder UI (apps/backoffice/src/app/(admin)/loyalty/engage/
 *      _components/PushRemindersTab.tsx).
 */

const BRAND_ID = "brand-celsius";

type Operator = ">=" | "<=" | ">" | "<" | "=" | "!=" | "in" | "not_in" | "is_true" | "is_false";

export type RuleCondition = {
  field: string;
  op: Operator;
  value?: unknown;
};

export type RuleNode =
  | { all: RuleNode[] }
  | { any: RuleNode[] }
  | RuleCondition;

type FieldKind = "number" | "string" | "boolean";

type FieldDef = {
  kind: FieldKind;
  /** Resolves the field for a single member. Cron loops members so
   *  this is called per-member; cache the heavy lookups upstream when
   *  the audience grows. */
  resolve: (memberId: string, ctx: AudienceCtx) => Promise<number | string | boolean | null>;
};

/** Heavy lookups (orders aggregate, member_brands row) cached per
 *  evaluation pass so multiple conditions on the same member don't
 *  hammer the DB. Built fresh per cron tick. */
type AudienceCtx = {
  brandRow:    Map<string, MemberBrandRow>;
  orderStats:  Map<string, OrderStats>;
  memberRow:   Map<string, MemberRow>;
  voucherActive: Map<string, boolean>;
};

type MemberBrandRow = {
  points_balance: number | null;
  last_visit_at:  string | null;
  current_tier_id: string | null;
  tier_name:      string | null;
};
type MemberRow = {
  birthday: string | null;
  created_at: string | null;
};
type OrderStats = {
  count: number;
  totalSpend: number; // RM
  lastOrderAt: string | null;
};

const FIELD_DEFS: Record<string, FieldDef> = {
  points_balance: {
    kind: "number",
    resolve: async (id, ctx) => ctx.brandRow.get(id)?.points_balance ?? 0,
  },
  current_tier_name: {
    kind: "string",
    resolve: async (id, ctx) => ctx.brandRow.get(id)?.tier_name ?? null,
  },
  days_since_last_order: {
    kind: "number",
    resolve: async (id, ctx) => {
      const last = ctx.orderStats.get(id)?.lastOrderAt
        ?? ctx.brandRow.get(id)?.last_visit_at
        ?? null;
      if (!last) return null;
      return Math.floor((Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000));
    },
  },
  total_lifetime_orders: {
    kind: "number",
    resolve: async (id, ctx) => ctx.orderStats.get(id)?.count ?? 0,
  },
  total_lifetime_spend: {
    kind: "number",
    resolve: async (id, ctx) => ctx.orderStats.get(id)?.totalSpend ?? 0,
  },
  days_since_signup: {
    kind: "number",
    resolve: async (id, ctx) => {
      const signup = ctx.memberRow.get(id)?.created_at;
      if (!signup) return null;
      return Math.floor((Date.now() - new Date(signup).getTime()) / (24 * 60 * 60 * 1000));
    },
  },
  days_since_birthday: {
    kind: "number",
    resolve: async (id, ctx) => {
      const bday = ctx.memberRow.get(id)?.birthday;
      if (!bday) return null;
      // Compute days since the most recent occurrence of MM-DD.
      const [, mm, dd] = bday.split("-");
      if (!mm || !dd) return null;
      const today = new Date();
      let target = new Date(today.getFullYear(), Number(mm) - 1, Number(dd));
      if (target.getTime() > today.getTime()) {
        target = new Date(today.getFullYear() - 1, Number(mm) - 1, Number(dd));
      }
      return Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
    },
  },
  has_active_voucher: {
    kind: "boolean",
    resolve: async (id, ctx) => ctx.voucherActive.get(id) ?? false,
  },
};

export function listSupportedFields(): { name: string; kind: FieldKind }[] {
  return Object.entries(FIELD_DEFS).map(([name, def]) => ({ name, kind: def.kind }));
}

/** Walk the rule tree and apply one condition at a time. Short-circuits
 *  AND on first false, OR on first true. */
async function evaluateNode(node: RuleNode, memberId: string, ctx: AudienceCtx): Promise<boolean> {
  if ("all" in node) {
    for (const child of node.all) {
      if (!(await evaluateNode(child, memberId, ctx))) return false;
    }
    return true;
  }
  if ("any" in node) {
    for (const child of node.any) {
      if (await evaluateNode(child, memberId, ctx)) return true;
    }
    return false;
  }

  // Leaf — a RuleCondition.
  const def = FIELD_DEFS[node.field];
  if (!def) {
    console.warn(`[audience] unknown field "${node.field}" — treating as no-match`);
    return false;
  }
  const actual = await def.resolve(memberId, ctx);
  return applyOperator(actual, node.op, node.value);
}

function applyOperator(actual: number | string | boolean | null, op: Operator, expected: unknown): boolean {
  // Null actual values fail every comparison except explicit existence
  // checks. Avoids surprising "null >= 100 is false but null != 100 is
  // true" footguns.
  if (actual === null || actual === undefined) return false;

  switch (op) {
    case ">=":  return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<=":  return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case ">":   return typeof actual === "number" && typeof expected === "number" && actual >  expected;
    case "<":   return typeof actual === "number" && typeof expected === "number" && actual <  expected;
    case "=":   return actual === expected;
    case "!=":  return actual !== expected;
    case "in":  return Array.isArray(expected) && expected.some((v) => v === actual);
    case "not_in": return Array.isArray(expected) && !expected.some((v) => v === actual);
    case "is_true":  return actual === true;
    case "is_false": return actual === false;
    default: return false;
  }
}

/** Build the per-pass context — pulls all the heavy reads once for
 *  a candidate set so per-member evaluation is in-memory. */
async function buildContext(memberIds: string[]): Promise<AudienceCtx> {
  const supabase = getSupabaseAdmin();
  const ctx: AudienceCtx = {
    brandRow:      new Map(),
    orderStats:    new Map(),
    memberRow:     new Map(),
    voucherActive: new Map(),
  };
  if (memberIds.length === 0) return ctx;

  // member_brands + tier name in one shot
  {
    const { data } = await supabase
      .from("member_brands")
      .select("member_id, points_balance, last_visit_at, current_tier_id, tier:tiers(name)")
      .eq("brand_id", BRAND_ID)
      .in("member_id", memberIds);
    for (const r of (data ?? []) as Array<{
      member_id: string;
      points_balance: number | null;
      last_visit_at: string | null;
      current_tier_id: string | null;
      tier: { name?: string | null } | null;
    }>) {
      ctx.brandRow.set(r.member_id, {
        points_balance:  r.points_balance,
        last_visit_at:   r.last_visit_at,
        current_tier_id: r.current_tier_id,
        tier_name:       r.tier?.name ?? null,
      });
    }
  }

  // members (birthday + created_at)
  {
    const { data } = await supabase
      .from("members")
      .select("id, birthday, created_at")
      .in("id", memberIds);
    for (const r of (data ?? []) as Array<{ id: string; birthday: string | null; created_at: string | null }>) {
      ctx.memberRow.set(r.id, { birthday: r.birthday, created_at: r.created_at });
    }
  }

  // orders aggregate — count, total spend, last order. Only loaded
  // when the rule actually touches one of those fields, but cheap
  // enough to always populate; spend depends on completed orders.
  {
    const { data } = await supabase
      .from("orders")
      .select("loyalty_id, total, created_at, status")
      .in("loyalty_id", memberIds);
    for (const o of (data ?? []) as Array<{ loyalty_id: string; total: number | null; created_at: string; status: string }>) {
      const stats = ctx.orderStats.get(o.loyalty_id) ?? { count: 0, totalSpend: 0, lastOrderAt: null };
      stats.count++;
      // status filter: only count revenue from non-cancelled / non-refunded.
      if (o.status !== "cancelled" && o.status !== "refunded") {
        stats.totalSpend += Number(o.total ?? 0) / 100;
      }
      if (!stats.lastOrderAt || o.created_at > stats.lastOrderAt) {
        stats.lastOrderAt = o.created_at;
      }
      ctx.orderStats.set(o.loyalty_id, stats);
    }
  }

  // active vouchers — boolean per member
  {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("issued_rewards")
      .select("member_id")
      .eq("brand_id", BRAND_ID)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .in("member_id", memberIds);
    for (const r of (data ?? []) as Array<{ member_id: string }>) {
      ctx.voucherActive.set(r.member_id, true);
    }
  }

  return ctx;
}

/** Evaluate the rule against the candidate member pool and return the
 *  matching member ids. Caller decides the candidate pool — typically
 *  "every member with a push token" so we don't waste evaluation cycles
 *  on phones we can't reach.
 */
export async function evaluateAudience(
  rule: RuleNode,
  candidateMemberIds: string[],
): Promise<string[]> {
  if (!rule || candidateMemberIds.length === 0) return [];
  const ctx = await buildContext(candidateMemberIds);
  const matches: string[] = [];
  for (const id of candidateMemberIds) {
    try {
      if (await evaluateNode(rule, id, ctx)) matches.push(id);
    } catch (err) {
      console.error(`[audience] evaluation failed for member ${id}:`, err);
    }
  }
  return matches;
}

/** Quick reachability filter — pull the set of members who have at
 *  least one push token, then narrow to the audience. Avoids
 *  evaluating predicates for thousands of dead phones. Capped at
 *  10k to stay under the cron timeout; campaigns with audiences
 *  that large should be rethought anyway.
 */
export async function reachableCandidateMemberIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("expo_push_tokens")
    .select("member_id")
    .not("member_id", "is", null)
    .limit(10_000);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ member_id: string | null }>) {
    if (r.member_id) set.add(r.member_id);
  }
  return Array.from(set);
}
