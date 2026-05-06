import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import type { MemberTier } from "@/lib/rewards";

type Props = {
  tier: MemberTier;
  onPress?: () => void;
  /** Display tone — `dark` for headers on espresso bg, `light` for white bg */
  tone?: "dark" | "light";
};

/**
 * Compact inline tier badge — for the home header, account header, etc.
 * Shows icon + tier name + multiplier on one line. Tap routes to a
 * details screen (when onPress is provided).
 */
export function TierBadge({ tier, onPress, tone = "dark" }: Props) {
  if (!tier.tier_name) return null;
  const color = tier.tier_color ?? "#92400e";
  const icon = tier.tier_icon ?? "☕";
  const mul = tier.tier_multiplier ?? 1;

  const bg = tone === "dark" ? "rgba(255,255,255,0.10)" : hexWithAlpha(color, 0.12);
  const fg = tone === "dark" ? "#FFFFFF" : color;
  const sub = tone === "dark" ? "rgba(255,255,255,0.60)" : "rgba(0,0,0,0.55)";

  const inner = (
    <View
      className="flex-row items-center rounded-full"
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text
        className="text-[12px]"
        style={{ fontFamily: "Peachi-Bold", color: fg }}
      >
        {tier.tier_name}
      </Text>
      <View
        style={{
          width: 1,
          height: 10,
          backgroundColor: tone === "dark" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)",
        }}
      />
      <Text
        className="text-[11px]"
        style={{ fontFamily: "SpaceGrotesk_600SemiBold", color: sub }}
      >
        {mul}× pts
      </Text>
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      className="active:opacity-70"
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
