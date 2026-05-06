import { ReactNode } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
  Circle,
} from "react-native-svg";
import type { TierStyle } from "../lib/tier-styles";

type Props = {
  style: TierStyle;
  paddingTop: number;
  paddingBottom?: number;
  children: ReactNode;
};

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Full-bleed gradient background for the home header. Drives a
 * tier-specific palette via lib/tier-styles. Optional radial glow in
 * the upper-right and a subtle sparkle field for higher tiers.
 *
 * Renders SVG at native dimensions; layout-wise the children render
 * on top in a regular RN View so flex / safe-area continue to work.
 */
export function TierHero({
  style,
  paddingTop,
  paddingBottom = 12,
  children,
}: Props) {
  // Height grows with safe-area inset; SVG is positioned absolutely so
  // it stretches to the View's measured size via flex absoluteFill.
  return (
    <View
      style={{
        paddingTop,
        paddingBottom,
        paddingHorizontal: 16,
        overflow: "hidden",
      }}
    >
      {/* Background — absolute positioned so children determine height */}
      <Svg
        height="100%"
        width="100%"
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id="tierGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={style.gradient[0]} />
            <Stop offset="1" stopColor={style.gradient[1]} />
          </SvgLinearGradient>
          {style.glow ? (
            <SvgRadialGradient
              id="tierGlow"
              cx="85%"
              cy="0%"
              rx="70%"
              ry="80%"
              fx="85%"
              fy="0%"
            >
              <Stop offset="0" stopColor={style.glow} stopOpacity="1" />
              <Stop offset="1" stopColor={style.glow} stopOpacity="0" />
            </SvgRadialGradient>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tierGrad)" />
        {style.glow ? (
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#tierGlow)" />
        ) : null}

        {/* Sparkle field — fixed-seed coordinates so it's deterministic
            without bringing in a randomness lib. Sparkles fade with
            distance from the upper-right glow. */}
        {style.sparkles ? (
          <>
            {SPARKLES.map((s, i) => (
              <Circle
                key={i}
                cx={s.x * SCREEN_W}
                cy={s.y * 140}
                r={s.r}
                fill={style.ornamentColor}
                opacity={s.o}
              />
            ))}
          </>
        ) : null}
      </Svg>

      {children}
    </View>
  );
}

// Hand-tuned, deterministic — keeps the same look across sessions and
// avoids re-render thrash that runtime randomness would cause.
const SPARKLES: { x: number; y: number; r: number; o: number }[] = [
  { x: 0.10, y: 0.18, r: 1.2, o: 0.55 },
  { x: 0.22, y: 0.62, r: 0.9, o: 0.40 },
  { x: 0.35, y: 0.30, r: 1.1, o: 0.50 },
  { x: 0.48, y: 0.78, r: 0.8, o: 0.35 },
  { x: 0.60, y: 0.20, r: 1.3, o: 0.65 },
  { x: 0.72, y: 0.55, r: 1.0, o: 0.45 },
  { x: 0.83, y: 0.35, r: 1.4, o: 0.70 },
  { x: 0.92, y: 0.72, r: 0.9, o: 0.45 },
  { x: 0.15, y: 0.88, r: 0.7, o: 0.30 },
  { x: 0.55, y: 0.05, r: 1.0, o: 0.55 },
];
