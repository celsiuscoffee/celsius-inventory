import { useEffect } from "react";
import { type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  interpolateColor,
} from "react-native-reanimated";

/**
 * Skeleton placeholder primitive. Pulses backgroundColor between
 * two greys to clearly signal "loading". The visible contrast
 * between the two colours (not just opacity) is what makes the
 * pulse readable on real devices — opacity alone barely registers.
 *
 * Pattern matches LinkedIn / Slack / Apple system skeletons: solid
 * shape that breathes between a darker grey (peak) and a lighter
 * grey (trough). 700 ms each direction = 1.4 s full breath, slow
 * enough to feel calm + fast enough to clearly read as motion.
 */

type Props = {
  width?: number | `${number}%`;
  height?: number;
  /** Sets borderRadius to height/2 → pill shape. */
  pill?: boolean;
  /** Sets borderRadius to width/2 → circle (assumes numeric square). */
  circle?: boolean;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

// Two-colour pulse range. Wide contrast on purpose — narrower greys
// (#D1 ↔ #EF) were tested first and the breath was too subtle to
// register on a phone screen at arm's length. #B0 ↔ #EE is roughly
// 60 hex units of contrast, which the eye can clearly track without
// being aggressive.
const PULSE_DARK   = "#B0B0B6";
const PULSE_LIGHT  = "#EEEEF2";
// 550ms each direction = 1.1s full breath. Slow enough to feel calm,
// fast enough that the rhythm is unmissable.
const PULSE_HALF_MS = 550;

export function Skeleton({
  width = "100%",
  height = 16,
  pill,
  circle,
  borderRadius,
  style,
}: Props) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: PULSE_HALF_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: PULSE_HALF_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(v);
  }, [v]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      v.value,
      [0, 1],
      [PULSE_DARK, PULSE_LIGHT],
    ),
  }));

  const resolvedRadius =
    circle && typeof width === "number" ? width / 2
    : pill   ? height / 2
    : borderRadius ?? 8;

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: resolvedRadius },
        animStyle,
        style,
      ]}
    />
  );
}
