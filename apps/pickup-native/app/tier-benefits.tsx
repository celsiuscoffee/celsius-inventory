import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Pressable,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Gift, Calendar, Sparkles, Lock, Coffee } from "lucide-react-native";
import { EspressoHeader } from "../components/EspressoHeader";
import { CelsiusLoader } from "../components/CelsiusLoader";
import { useApp } from "../lib/store";
import { fetchTier } from "../lib/rewards";
import { supabase } from "../lib/supabase";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 32;          // 16px gutter each side
const CARD_GAP = 12;
const SNAP = CARD_W + CARD_GAP;

type BenefitRule = {
  type: string;
  value?: number;
  label?: string;
  reward_id?: string;
};

type Tier = {
  id: string;
  slug: string;
  name: string;
  min_visits: number | null;
  min_spend: number | null;
  multiplier: number;
  color: string | null;
  icon: string | null;
  benefits: string[] | null;
  benefit_rules: BenefitRule[] | null;
  qualification_metric: string | null;
  sort_order: number | null;
};

async function fetchAllTiers(): Promise<Tier[]> {
  const { data, error } = await supabase
    .from("tiers")
    .select("id,slug,name,min_visits,min_spend,multiplier,color,icon,benefits,benefit_rules,qualification_metric,sort_order")
    .eq("brand_id", "brand-celsius")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("min_visits", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data ?? []) as Tier[];
}

export default function TierBenefits() {
  const loyaltyId = useApp((s) => s.loyaltyId);
  const tiersQ = useQuery({ queryKey: ["tiers"], queryFn: fetchAllTiers, staleTime: 5 * 60_000 });
  const memberTierQ = useQuery({
    queryKey: ["member-tier", loyaltyId],
    queryFn: () => (loyaltyId ? fetchTier(loyaltyId) : Promise.resolve(null)),
    enabled: !!loyaltyId,
    staleTime: 60_000,
  });

  const tiers = tiersQ.data ?? [];
  const currentSlug = memberTierQ.data?.tier_slug ?? null;
  const currentIdx = useMemo(
    () => Math.max(0, tiers.findIndex((t) => t.slug === currentSlug)),
    [tiers, currentSlug],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Snap to the customer's current tier on first load.
  useEffect(() => {
    if (tiers.length === 0) return;
    setActiveIdx(currentIdx);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: currentIdx * SNAP, animated: false });
    });
  }, [tiers.length, currentIdx]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP);
    if (idx !== activeIdx && idx >= 0 && idx < tiers.length) setActiveIdx(idx);
  };

  if (tiersQ.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <EspressoHeader title="Membership" showBack showCart={false} />
        <View className="flex-1 items-center justify-center">
          <CelsiusLoader size="md" />
        </View>
      </View>
    );
  }

  const activeTier = tiers[activeIdx];

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Membership" showBack showCart={false} />

      <ScrollView contentContainerClassName="pb-24">
        {/* Tier pager — horizontal swipe between tier cards */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SNAP}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}
          onMomentumScrollEnd={onScroll}
        >
          {tiers.map((t, idx) => (
            <View key={t.id} style={{ width: CARD_W, marginRight: idx < tiers.length - 1 ? CARD_GAP : 0 }}>
              <TierHeroCard
                tier={t}
                isCurrent={idx === currentIdx}
                isLocked={idx > currentIdx}
                isAchieved={idx < currentIdx}
                memberVisits={memberTierQ.data?.visits_this_period ?? 0}
                memberSpend={memberTierQ.data?.spend_this_period ?? 0}
              />
            </View>
          ))}
        </ScrollView>

        {/* Page indicator dots */}
        <View className="flex-row items-center justify-center mt-3" style={{ gap: 6 }}>
          {tiers.map((_, idx) => (
            <View
              key={idx}
              style={{
                width: idx === activeIdx ? 14 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: idx === activeIdx ? "#160800" : "rgba(26,2,0,0.18)",
              }}
            />
          ))}
        </View>

        {/* Benefits for the active tier */}
        {activeTier ? (
          <BenefitsSection tier={activeTier} isLocked={activeIdx > currentIdx} />
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Hero card                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function TierHeroCard({
  tier,
  isCurrent,
  isLocked,
  isAchieved,
  memberVisits,
  memberSpend,
}: {
  tier: Tier;
  isCurrent: boolean;
  isLocked: boolean;
  isAchieved: boolean;
  memberVisits: number;
  memberSpend: number;
}) {
  const color = tier.color || "#92400e";
  const isLightColor = color.toUpperCase() === "#FFFFFF" || color.toUpperCase() === "#FFF";
  const safeColor = isLightColor ? "#A87A4A" : color;

  // Visit-based progress for the next tier — falls back to spend if visits not set.
  const needVisits = tier.min_visits ?? 0;
  const needSpend  = Number(tier.min_spend ?? 0);
  const cupsAway = Math.max(0, needVisits - memberVisits);
  const ringgitAway = Math.max(0, needSpend - memberSpend);
  const useVisits = needVisits > 0;
  const progressPct = useVisits
    ? Math.min(1, memberVisits / Math.max(1, needVisits))
    : Math.min(1, memberSpend / Math.max(1, needSpend));

  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: hexAlpha(safeColor, 0.18),
        borderWidth: 1,
        borderColor: hexAlpha(safeColor, 0.32),
        opacity: isLocked ? 0.92 : 1,
      }}
    >
      {/* Top color rail */}
      <View style={{ height: 4, backgroundColor: safeColor }} />

      <View style={{ padding: 18, minHeight: 168 }}>
        {/* Eyebrow row */}
        <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
          {isCurrent ? (
            <View
              style={{
                backgroundColor: safeColor,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontFamily: "SpaceGrotesk_700Bold", fontSize: 10, letterSpacing: 1.5 }}>
                MY TIER
              </Text>
            </View>
          ) : isAchieved ? (
            <Text
              style={{
                fontFamily: "SpaceGrotesk_700Bold",
                fontSize: 10,
                letterSpacing: 1.5,
                color: hexAlpha(safeColor, 0.7),
              }}
            >
              UNLOCKED
            </Text>
          ) : (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Lock size={11} color={hexAlpha(safeColor, 0.55)} />
              <Text
                style={{
                  fontFamily: "SpaceGrotesk_700Bold",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: hexAlpha(safeColor, 0.6),
                }}
              >
                LOCKED
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 28 }}>{tier.icon || "☕"}</Text>
        </View>

        {/* Tier name */}
        <Text
          style={{
            fontFamily: "Peachi-Bold",
            fontSize: 24,
            color: safeColor,
            lineHeight: 28,
          }}
        >
          {tier.name}
        </Text>

        {/* Multiplier badge */}
        <View className="flex-row items-center" style={{ marginTop: 6, gap: 4 }}>
          <Coffee size={12} color={hexAlpha(safeColor, 0.85)} />
          <Text style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 12, color: hexAlpha(safeColor, 0.85) }}>
            {Number(tier.multiplier).toFixed(Number(tier.multiplier) % 1 === 0 ? 0 : 2).replace(/0+$/, "").replace(/\.$/, "")}× points
          </Text>
        </View>

        {/* Progress / requirement strip */}
        <View style={{ marginTop: 14 }}>
          {isCurrent ? (
            <>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: hexAlpha(safeColor, 0.18),
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.round(progressPct * 100)}%`,
                    backgroundColor: safeColor,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: "SpaceGrotesk_500Medium",
                  fontSize: 12,
                  color: hexAlpha(safeColor, 0.8),
                }}
              >
                {cupsAway === 0 && ringgitAway === 0
                  ? "You're at the top of this tier"
                  : useVisits
                    ? `${cupsAway} cup${cupsAway === 1 ? "" : "s"} this period`
                    : `RM${ringgitAway.toFixed(0)} more this period`}
              </Text>
            </>
          ) : isLocked ? (
            <Text
              style={{
                fontFamily: "SpaceGrotesk_500Medium",
                fontSize: 12,
                color: hexAlpha(safeColor, 0.75),
                lineHeight: 18,
              }}
            >
              Reach this tier by hitting{" "}
              <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
                {useVisits ? `${needVisits} cups` : `RM${needSpend.toFixed(0)} spend`}
              </Text>
              {useVisits && needSpend > 0 ? ` or RM${needSpend.toFixed(0)} spend` : ""}
            </Text>
          ) : (
            <Text
              style={{
                fontFamily: "SpaceGrotesk_500Medium",
                fontSize: 12,
                color: hexAlpha(safeColor, 0.8),
              }}
            >
              Achieved · perks unlocked
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Benefits section                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function BenefitsSection({ tier, isLocked }: { tier: Tier; isLocked: boolean }) {
  const rules = tier.benefit_rules ?? [];

  // Group benefit_rules into customer-facing sections.
  const points    = rules.filter((r) => r.type === "points_multiplier");
  const birthday  = rules.filter((r) => r.type === "birthday_reward");
  const perks     = rules.filter((r) => r.type === "early_access" || r.type === "monthly_perk");
  const exclusive = rules.filter((r) => r.type === "exclusive_event");

  const fallbackBenefits = (tier.benefits ?? []).filter(
    (b) => !points.some((p) => b.includes(`${p.value}×`)) && !birthday.length || true, // always render below if rules empty
  );

  return (
    <View className="px-4" style={{ paddingTop: 16 }}>
      {points.length > 0 && (
        <Section title="Member Rewards" muted={isLocked}>
          <BenefitCard
            icon={<Star size={20} color="#C05040" />}
            label={`${Number(points[0].value).toString().replace(/\.0$/, "")}× points on every purchase`}
            muted={isLocked}
          />
        </Section>
      )}

      {birthday.length > 0 && (
        <Section title="Birthday Gifts" muted={isLocked}>
          <BenefitCard icon={<Gift size={20} color="#C05040" />} label="Free birthday drink" muted={isLocked} />
        </Section>
      )}

      {perks.length > 0 && (
        <Section title="Member Perks" muted={isLocked}>
          {perks.map((p, i) => (
            <BenefitCard
              key={i}
              icon={<Calendar size={20} color="#C05040" />}
              label={p.label ?? p.type.replace(/_/g, " ")}
              muted={isLocked}
            />
          ))}
        </Section>
      )}

      {exclusive.length > 0 && (
        <Section title="VIP Special" muted={isLocked}>
          {exclusive.map((p, i) => (
            <BenefitCard
              key={i}
              icon={<Sparkles size={20} color="#C05040" />}
              label={p.label ?? "Exclusive event invites"}
              muted={isLocked}
            />
          ))}
        </Section>
      )}

      {/* If the DB only has plain `benefits[]` strings (no benefit_rules),
          show them as a flat fallback list so nothing important is hidden. */}
      {rules.length === 0 && (tier.benefits?.length ?? 0) > 0 && (
        <Section title="What you get" muted={isLocked}>
          {tier.benefits!.map((b, i) => (
            <BenefitCard key={i} icon={<Star size={20} color="#C05040" />} label={b} muted={isLocked} />
          ))}
        </Section>
      )}

      {/* CTA to rewards screen for actual point-redemption catalogue */}
      <Pressable
        onPress={() => router.push("/rewards")}
        className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel="View rewards catalogue"
      >
        <Text style={{ color: "#C05040", fontFamily: "Peachi-Bold", fontSize: 15 }}>
          See rewards catalogue →
        </Text>
        <Text
          style={{
            color: "rgba(26,2,0,0.6)",
            fontFamily: "SpaceGrotesk_400Regular",
            fontSize: 12,
            marginTop: 4,
            lineHeight: 18,
          }}
        >
          Redeem points for free drinks, RM5 / RM10 vouchers, and birthday gifts
        </Text>
      </Pressable>
    </View>
  );
}

function Section({
  title,
  children,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          fontFamily: "Peachi-Bold",
          fontSize: 16,
          color: muted ? "rgba(26,2,0,0.55)" : "#160800",
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function BenefitCard({
  icon,
  label,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  muted?: boolean;
}) {
  return (
    <View
      className="flex-row items-center rounded-xl border border-border bg-surface p-3"
      style={{ gap: 12, opacity: muted ? 0.55 : 1 }}
    >
      <View
        className="rounded-lg items-center justify-center"
        style={{ width: 40, height: 40, backgroundColor: "rgba(192,80,64,0.08)" }}
      >
        {icon}
      </View>
      <Text
        className="flex-1"
        style={{
          fontFamily: "SpaceGrotesk_500Medium",
          fontSize: 14,
          color: "#160800",
          lineHeight: 20,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim().replace(/^#/, ""));
  if (!m) return `rgba(146,64,14,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
