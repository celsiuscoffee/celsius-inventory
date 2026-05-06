import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import type { MemberTier } from "@/lib/rewards";

type Props = {
  tier: MemberTier;
  onPress?: () => void;
};

/**
 * Tier hero card for the Account tab. Designed to read at a glance:
 * - Big icon + tier name in Peachi-Bold (matches app brand).
 * - "1.5× points · 12 / 20 visits" inline metric strip so the customer
 *   sees both rate and progress without parsing two paragraphs.
 * - Color-tinted background using the tier color, with a stronger
 *   accent rail at the top so each tier feels visually distinct
 *   (Sephora / Starbucks pattern).
 * - Tap → opens detail sheet (currently routes via onPress).
 */
export function TierCard({ tier, onPress }: Props) {
  const color = tier.tier_color ?? "#92400e";
  const icon = tier.tier_icon ?? "☕";
  const name = tier.tier_name ?? "Member";
  const mul = tier.tier_multiplier ?? 1;

  // Pick whichever metric the customer is closer to so the bar feels
  // achievable. If both are 0 (Bronze), show a neutral 0% bar.
  const visitsTotal = tier.next_tier_min_visits ?? 0;
  const visitsCurrent = tier.visits_this_period;
  const visitsPct = visitsTotal > 0 ? Math.min(visitsCurrent / visitsTotal, 1) : 0;

  const spendTotal = tier.next_tier_min_spend ?? 0;
  const spendCurrent = tier.spend_this_period;
  const spendPct = spendTotal > 0 ? Math.min(spendCurrent / spendTotal, 1) : 0;

  const useSpendBar = spendPct > visitsPct && spendTotal > 0;
  const progressPct = tier.next_tier_id ? (useSpendBar ? spendPct : visitsPct) : 1;

  const inner = (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: hexWithAlpha(color, 0.08),
        borderWidth: 1,
        borderColor: hexWithAlpha(color, 0.18),
      }}
    >
      {/* Top color rail — gives each tier its visual signature */}
      <View style={{ height: 4, backgroundColor: color }} />

      <View className="px-5 pt-4 pb-5">
        {/* Header: icon + name + multiplier badge */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              className="rounded-2xl items-center justify-center"
              style={{
                width: 48,
                height: 48,
                backgroundColor: hexWithAlpha(color, 0.18),
              }}
            >
              <Text style={{ fontSize: 28, lineHeight: 32 }}>{icon}</Text>
            </View>
            <View>
              <Text
                className="text-[10px] tracking-widest uppercase"
                style={{
                  fontFamily: "SpaceGrotesk_600SemiBold",
                  color: hexWithAlpha(color, 0.7),
                }}
              >
                Your tier
              </Text>
              <Text
                className="text-[20px]"
                style={{ fontFamily: "Peachi-Bold", color }}
              >
                {name}
              </Text>
            </View>
          </View>
          <View
            className="rounded-full"
            style={{
              backgroundColor: color,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              className="text-white text-[12px]"
              style={{ fontFamily: "Peachi-Bold" }}
            >
              {mul}× pts
            </Text>
          </View>
        </View>

        {/* Progress bar + label */}
        {tier.next_tier_id ? (
          <View>
            <View className="flex-row justify-between mb-2">
              <Text
                className="text-[12px]"
                style={{
                  fontFamily: "SpaceGrotesk_500Medium",
                  color: "rgba(0,0,0,0.65)",
                }}
              >
                {useSpendBar
                  ? `RM${Math.round(spendCurrent)} / RM${spendTotal}`
                  : `${visitsCurrent} / ${visitsTotal} visits`}
              </Text>
              <Text
                className="text-[12px]"
                style={{ fontFamily: "Peachi-Bold", color }}
              >
                → {tier.next_tier_name}
              </Text>
            </View>
            <View
              className="rounded-full overflow-hidden"
              style={{ height: 6, backgroundColor: hexWithAlpha(color, 0.15) }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.round(progressPct * 100)}%`,
                  backgroundColor: color,
                  borderRadius: 999,
                }}
              />
            </View>
            <Text
              className="text-[11px] mt-2"
              style={{
                fontFamily: "SpaceGrotesk_500Medium",
                color: "rgba(0,0,0,0.55)",
              }}
            >
              {useSpendBar
                ? `RM${tier.spend_to_next_tier.toFixed(0)} more to unlock`
                : `${tier.visits_to_next_tier} more visit${tier.visits_to_next_tier === 1 ? "" : "s"} to unlock`}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Text style={{ fontSize: 14 }}>👑</Text>
            <Text
              className="text-[13px]"
              style={{ fontFamily: "Peachi-Bold", color }}
            >
              You&apos;ve reached the top tier
            </Text>
          </View>
        )}

        {/* Footer CTA */}
        {onPress && (
          <View
            className="flex-row items-center justify-end mt-4 pt-3"
            style={{ borderTopWidth: 1, borderTopColor: hexWithAlpha(color, 0.15) }}
          >
            <Text
              className="text-[12px]"
              style={{ fontFamily: "Peachi-Bold", color }}
            >
              See benefits
            </Text>
            <ChevronRight size={16} color={color} />
          </View>
        )}
      </View>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      className="active:opacity-90"
    >
      {inner}
    </Pressable>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
