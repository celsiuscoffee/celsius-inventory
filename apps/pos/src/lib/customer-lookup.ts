import { createClient } from "./supabase-browser";

export type LoyaltyMember = {
  id: string;
  phone: string;
  name: string | null;
  tags: string[];
  points_balance: number;
  total_spent: number;
  total_visits: number;
  last_visit_at: string | null;
};

/**
 * Look up a loyalty member by phone number.
 * Searches the existing `members` + `member_brands` tables from the Loyalty app.
 * Returns member info with tags, points, and spend history.
 */
export async function lookupMemberByPhone(phone: string): Promise<LoyaltyMember | null> {
  const supabase = createClient();

  // Generate all possible phone formats to search
  const stripped = phone.replace(/[\s\-\+\(\)]/g, "");
  const variants = new Set<string>();
  variants.add(stripped);
  // 0123456789 → 60123456789
  if (stripped.startsWith("0")) variants.add("60" + stripped.substring(1));
  // 60123456789 → 0123456789
  if (stripped.startsWith("60")) variants.add("0" + stripped.substring(2));
  // 123456789 → 60123456789 and 0123456789
  if (!stripped.startsWith("0") && !stripped.startsWith("6")) {
    variants.add("60" + stripped);
    variants.add("0" + stripped);
  }
  // +60123456789 already stripped to 60123456789

  // Search members table — try all variants
  const { data: members } = await supabase
    .from("members")
    .select("id, phone, name, tags")
    .in("phone", [...variants]);

  const member = members?.[0] ?? null;
  if (!member) return null;

  // Get points + spend from member_brands
  const { data: mb } = await supabase
    .from("member_brands")
    .select("points_balance, total_spent, total_visits, last_visit_at")
    .eq("member_id", member.id)
    .eq("brand_id", "brand-celsius")
    .maybeSingle();

  return {
    id: member.id,
    phone: member.phone,
    name: member.name,
    tags: member.tags ?? [],
    points_balance: mb?.points_balance ?? 0,
    total_spent: parseFloat(mb?.total_spent ?? "0"),
    total_visits: mb?.total_visits ?? 0,
    last_visit_at: mb?.last_visit_at ?? null,
  };
}

/**
 * Get all unique member tags in use (for promotion setup)
 */
export async function fetchAllMemberTags(): Promise<string[]> {
  const supabase = createClient();
  let data: string[] | null = null;
  try {
    const res = await supabase.rpc("get_distinct_member_tags");
    data = res.data as string[] | null;
  } catch { /* RPC doesn't exist, use fallback */ }

  // Fallback: query directly
  if (!data) {
    const { data: members } = await supabase
      .from("members")
      .select("tags")
      .not("tags", "eq", "{}");
    if (!members) return [];
    const allTags = new Set<string>();
    for (const m of members) {
      for (const tag of (m.tags ?? [])) {
        allTags.add(tag);
      }
    }
    return [...allTags].sort();
  }
  return (data as string[]).sort();
}

/**
 * Check if a member meets the eligibility criteria of a promotion.
 */
export function memberMeetsEligibility(
  member: LoyaltyMember | null,
  eligibility: string,
  eligibleTags: string[],
  eligibleTiers: string[],
): boolean {
  switch (eligibility) {
    case "everyone":
      return true;

    case "customer_tags":
      if (!member) return false;
      // Member must have at least one of the eligible tags
      return eligibleTags.some((tag) => member.tags.includes(tag));

    case "membership":
      if (!member) return false;
      // Member must have a tier tag matching one of the eligible tiers
      return eligibleTiers.some((tier) => member.tags.includes(tier));

    case "first_time":
      if (!member) return true; // No member record = first time
      return member.total_visits <= 1;

    case "min_spend":
      if (!member) return false;
      // Check if member has spent enough (for future use)
      return true;

    default:
      return true;
  }
}
