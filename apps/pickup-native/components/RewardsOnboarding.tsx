/**
 * RewardsOnboarding — one-time bottom-sheet shown on the Rewards screen
 * for customers who haven't seen the v2 walkthrough.
 *
 * Brand: CC v2026 §1.4 — espresso surface with amber accents, Peachi
 * for headlines. Dismissed by tapping the CTA or the backdrop; either
 * marks the onboarding key seen so it never resurfaces.
 */

import { useEffect } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from "react-native-reanimated";
import { Sparkles, Gift, Target, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function RewardsOnboarding({ visible, onDismiss }: Props) {
  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 14, stiffness: 110 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(400, { duration: 220 });
    }
  }, [visible, opacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  function dismiss() {
    Haptics.selectionAsync();
    onDismiss();
  }

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0, right: 0, top: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
          },
          backdropStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            backgroundColor: "#1A0200",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 36,
          },
          sheetStyle,
        ]}
      >
        {/* Drag indicator */}
        <View
          style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: "rgba(251,191,36,0.3)",
            alignSelf: "center",
            marginBottom: 18,
          }}
        />

        <Text
          style={{
            fontFamily: "SpaceGrotesk_700Bold",
            fontSize: 10,
            color: "#FBBF24",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          What&apos;s new
        </Text>
        <Text
          style={{
            fontFamily: "Peachi-Bold",
            fontSize: 26,
            color: "#FBBF24",
            letterSpacing: -0.5,
            marginBottom: 16,
          }}
        >
          Rewards just got better
        </Text>

        <Row
          icon={Target}
          title="Pick weekly challenges"
          body="Choose a mission each Monday — order patterns earn you vouchers."
        />
        <Row
          icon={Sparkles}
          title="Mystery Bean on every order"
          body="Tap-to-reveal bonuses: 2× / 3× / 5× Bean multipliers or a free pastry."
        />
        <Row
          icon={Gift}
          title="Your voucher wallet"
          body="Earned vouchers apply at checkout — no codes or scans needed."
          last
        />

        <Pressable
          onPress={dismiss}
          className="active:opacity-80"
          style={{
            marginTop: 24,
            backgroundColor: "#FBBF24",
            borderRadius: 100,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Text style={{ fontFamily: "Peachi-Bold", fontSize: 15, color: "#1A0200" }}>
            Got it
          </Text>
          <Check size={16} color="#1A0200" strokeWidth={2.6} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function Row({
  icon: Icon, title, body, last,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(251,191,36,0.10)",
      }}
    >
      <View
        style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: "rgba(251,191,36,0.18)",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon size={20} color="#FBBF24" strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Peachi-Bold",
            fontSize: 15,
            color: "#FFFFFF",
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "SpaceGrotesk_500Medium",
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 18,
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}
