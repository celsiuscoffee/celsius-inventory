/**
 * MysteryBean — tap-to-reveal scratch card displayed on order confirmation.
 *
 * Matches the app's existing card vocabulary: rounded-2xl, Peachi headings,
 * Space Grotesk body, brand colours.
 *
 * States:
 *  - Unrevealed: terracotta tile (matches RewardTicket's terracotta tone)
 *  - Win: espresso surface, amber title (matches RewardTicket's gold tone)
 *  - No-bonus: quiet white card with brand border — never feels punishing
 */

import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring,
  withTiming, withRepeat, Easing,
} from "react-native-reanimated";
import { Gift, Sparkles, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { revealMysteryDrop, type MysteryDropRevealed } from "../lib/rewards-v2";

type Props = {
  dropId: string;
  baseBeansEarned: number;
  onRevealed?: (drop: MysteryDropRevealed) => void;
};

export function MysteryBean({ dropId, baseBeansEarned, onRevealed }: Props) {
  const [revealed, setRevealed] = useState<MysteryDropRevealed | null>(null);
  const [loading, setLoading] = useState(false);

  const shimmer = useSharedValue(-1);
  useEffect(() => {
    if (!revealed) {
      shimmer.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.linear }),
        -1,
        false
      );
    }
  }, [revealed, shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 220 }],
  }));

  const scale = useSharedValue(1);
  const cardScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  async function handleReveal() {
    if (loading || revealed) return;
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await revealMysteryDrop(dropId);
      if (result.outcome_type === "no_bonus") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      scale.value = withSequence(
        withTiming(0.85, { duration: 120 }),
        withSpring(1.0, { damping: 8, stiffness: 140 })
      );
      setRevealed(result);
      onRevealed?.(result);
    } catch (err) {
      console.warn("Mystery reveal failed", err);
    } finally {
      setLoading(false);
    }
  }

  if (!revealed) {
    return (
      <Pressable onPress={handleReveal} disabled={loading}>
        <Animated.View
          className="bg-primary rounded-2xl px-5 py-6 items-center overflow-hidden"
          style={[
            {
              shadowColor: "#160800",
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            },
            cardScaleStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: -120,
                width: 100,
                height: "100%",
                backgroundColor: "rgba(255,255,255,0.18)",
              },
              shimmerStyle,
            ]}
          />

          <Gift size={44} color="#FFFFFF" strokeWidth={1.8} />

          <Text
            className="text-white/85 text-[10px] uppercase mt-3.5"
            style={{ fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 2 }}
          >
            Tap to Reveal
          </Text>
          <Text
            className="text-white text-[26px] mt-1"
            style={{ fontFamily: "Peachi-Bold", letterSpacing: -0.3 }}
          >
            Mystery Bean
          </Text>
          <Text
            className="text-white/85 text-[13px] mt-1.5 text-center"
            style={{ fontFamily: "SpaceGrotesk_500Medium" }}
          >
            You&apos;ve got something. One tap.
          </Text>

          <View
            className="bg-white rounded-full mt-4 px-5 py-2.5 flex-row items-center"
            style={{ gap: 6 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1A0200" />
            ) : (
              <>
                <Text
                  className="text-espresso text-[13px]"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  Reveal
                </Text>
                <ChevronRight size={14} color="#1A0200" strokeWidth={2.4} />
              </>
            )}
          </View>
        </Animated.View>
      </Pressable>
    );
  }

  return <MysteryReveal drop={revealed} baseBeansEarned={baseBeansEarned} />;
}

function MysteryReveal({
  drop,
  baseBeansEarned,
}: {
  drop: MysteryDropRevealed;
  baseBeansEarned: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withSpring(0, { damping: 10, stiffness: 100 });
  }, [opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isMultiplier =
    drop.outcome_type === "beans_multiplier" && drop.multiplier_value && drop.multiplier_value > 1;
  const isVoucher = drop.outcome_type === "voucher";
  const isNoBonus = drop.outcome_type === "no_bonus";

  // No-bonus: quiet white card. Same as Card primitive (rounded-2xl + border-border).
  if (isNoBonus) {
    return (
      <Animated.View
        className="bg-surface rounded-2xl border border-border p-5 items-center"
        style={containerStyle}
      >
        <Sparkles size={32} color="#6B6B6B" strokeWidth={1.6} />
        <Text
          className="text-espresso text-[18px] mt-2.5"
          style={{ fontFamily: "Peachi-Bold" }}
        >
          No bonus this time
        </Text>
        <Text
          className="text-muted-fg text-[13px] mt-1"
          style={{ fontFamily: "SpaceGrotesk_500Medium" }}
        >
          Better luck on your next order ☕
        </Text>
      </Animated.View>
    );
  }

  // Win: espresso surface + amber text — matches RewardTicket gold tone for auto-issued
  return (
    <Animated.View
      className="bg-espresso rounded-2xl px-6 py-7 items-center"
      style={[
        {
          shadowColor: "#1A0200",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 18,
          elevation: 6,
        },
        containerStyle,
      ]}
    >
      <Sparkles size={38} color="#FBBF24" strokeWidth={1.6} />

      {isMultiplier && (
        <>
          <Text
            className="text-amber-400 mt-2.5"
            style={{
              fontFamily: "Peachi-Bold",
              fontSize: 56,
              letterSpacing: -2,
              lineHeight: 56,
            }}
          >
            {drop.multiplier_value}×
          </Text>
          <Text
            className="text-[10px] uppercase mt-1.5"
            style={{
              fontFamily: "SpaceGrotesk_700Bold",
              letterSpacing: 2,
              color: "rgba(251,191,36,0.85)",
            }}
          >
            Bean Multiplier
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: "rgba(251,191,36,0.18)",
              alignSelf: "stretch",
              marginVertical: 18,
              marginHorizontal: -24,
            }}
          />
          <Text
            className="text-white/70 text-[13px] text-center"
            style={{ fontFamily: "SpaceGrotesk_500Medium" }}
          >
            Your {baseBeansEarned} Beans became
          </Text>
          <Text
            className="text-white text-[22px] mt-0.5"
            style={{ fontFamily: "Peachi-Bold" }}
          >
            {drop.total_beans_awarded} Beans
          </Text>
        </>
      )}

      {isVoucher && (
        <>
          <Text
            className="text-amber-400 text-[22px] text-center mt-2.5"
            style={{ fontFamily: "Peachi-Bold", letterSpacing: -0.3 }}
          >
            {drop.label}
          </Text>
          <Text
            className="text-white/75 text-[13px] mt-1.5 text-center"
            style={{ fontFamily: "SpaceGrotesk_500Medium" }}
          >
            Added to your voucher wallet
          </Text>
        </>
      )}

      {drop.outcome_type === "flat_beans" && drop.flat_beans_value && (
        <>
          <Text
            className="text-amber-400 mt-2.5"
            style={{ fontFamily: "Peachi-Bold", fontSize: 48, letterSpacing: -2 }}
          >
            +{drop.flat_beans_value}
          </Text>
          <Text
            className="text-[10px] uppercase mt-1"
            style={{
              fontFamily: "SpaceGrotesk_700Bold",
              letterSpacing: 2,
              color: "rgba(251,191,36,0.85)",
            }}
          >
            Bonus Beans
          </Text>
        </>
      )}

      {drop.outcome_type === "surprise_in_store" && (
        <>
          <Text
            className="text-amber-400 text-[20px] text-center mt-2.5"
            style={{ fontFamily: "Peachi-Bold" }}
          >
            Surprise at pickup
          </Text>
          <Text
            className="text-white/75 text-[13px] mt-1.5 text-center"
            style={{ fontFamily: "SpaceGrotesk_500Medium" }}
          >
            Show this to the barista when you collect your order
          </Text>
        </>
      )}
    </Animated.View>
  );
}
