import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

/**
 * Reusable shimmer overlay — a soft-edged band that sweeps left to
 * right across its parent container on a loop. Drop it inside any
 * relatively-positioned container with `overflow: hidden` and it
 * paints the "loading" / "tap to reveal" motion.
 *
 * Why this exists as a shared component:
 *   - Skeleton primitives use it for content loading.
 *   - MysteryBean uses it for the "tap to reveal" tease.
 *   - Both used to have their own hard-edged-band implementations
 *     that read as "a smaller box sliding over a bigger box" per
 *     QA. A single soft-edged implementation makes the motion read
 *     as polish wherever it appears.
 *
 * Soft edges are faked with 7 vertical opacity slices in a bell-curve
 * profile (0, 0.15, 0.45, 1.0, 0.45, 0.15, 0). With expo-linear-
 * gradient we could do true gradient edges, but that's a native
 * module → no OTA. At 60 fps the stepped edges blend smoothly enough
 * that the eye reads it as a soft band.
 */

type Props = {
  /** Container width in pixels. Drives the sweep distance and the
   *  band's own width. Pass via onLayout from the parent — Animated
   *  worklets need real numbers, not percentages. */
  containerWidth: number;
  /** Highlight colour at peak opacity. Pick to contrast against the
   *  parent's bg: white for grey skeletons, white-with-low-overall-
   *  opacity for coloured backgrounds. */
  highlightColor?: string;
  /** Peak opacity of the centre slice. The bell curve scales from
   *  this. Keep low (0.2-ish) on coloured backgrounds, higher (0.9)
   *  on flat-grey skeletons. */
  maxOpacity?: number;
  /** Band width as fraction of containerWidth. 0.7 = the band is
   *  70% of the parent's width. */
  widthRatio?: number;
  /** Sweep duration in ms. Slower reads as more relaxed; faster as
   *  more urgent. */
  durationMs?: number;
};

// Bell-curve opacity profile. Edges at 0 fade fully to base; centre
// peaks at 1.0 × maxOpacity.
const PROFILE = [0.0, 0.15, 0.45, 1.0, 0.45, 0.15, 0.0];

export function ShimmerSweep({
  containerWidth,
  highlightColor = "#FFFFFF",
  maxOpacity     = 0.85,
  widthRatio     = 0.7,
  durationMs     = 1400,
}: Props) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (containerWidth <= 0) return;
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, {
        duration: durationMs,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false,
    );
    return () => cancelAnimation(sweep);
  }, [containerWidth, durationMs, sweep]);

  const bandWidth = containerWidth * widthRatio;
  const sliceCount = PROFILE.length;
  const sliceWidth = bandWidth / sliceCount;

  const sweepStyle = useAnimatedStyle(() => {
    const x = -bandWidth + (containerWidth + bandWidth) * sweep.value;
    return { transform: [{ translateX: x }], width: bandWidth };
  });

  if (containerWidth <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", top: 0, bottom: 0, flexDirection: "row" },
        sweepStyle,
      ]}
    >
      {PROFILE.map((p, i) => (
        <View
          key={i}
          style={{
            width: sliceWidth,
            height: "100%",
            backgroundColor: highlightColor,
            opacity: p * maxOpacity,
          }}
        />
      ))}
    </Animated.View>
  );
}
