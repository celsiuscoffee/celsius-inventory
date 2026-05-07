import { ReactNode } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
  Ellipse,
} from "react-native-svg";
import type { TierStyle } from "../lib/tier-styles";

type Props = {
  style: TierStyle;
  paddingTop: number;
  paddingBottom?: number;
  /** Tall hero (Rewards/Account) vs compact (Home). */
  variant?: "compact" | "tall";
  children: ReactNode;
};

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Tier-themed hero header.
 *
 * Two layers, painted back-to-front:
 *
 *   1. Solid `backgroundColor` from the gradient's deepest stop. Acts
 *      as the always-visible base — even if the SVG fails to render
 *      (RN-web glitches, layout edge cases), the View stays the
 *      tier's signature colour. Earlier attempts had cream body
 *      bleed-through; this fixes that without depending on SVG.
 *   2. SVG overlay: linear gradient + radial accent glow + a couple
 *      of ghosted coffee beans. Sized via absoluteFill so it fills
 *      whatever height the View grows to.
 *
 * Children render in a normal RN View on top — flow is left to grow
 * the View naturally. minHeight (110 compact / 200 tall) prevents
 * shrinking below the design height when content alone is short.
 *
 * Soft bottom corners via borderBottomRadius give the "drape into
 * body" effect without an SVG mask.
 */
export function TierHero({
  style,
  paddingTop,
  paddingBottom = 24,
  variant = "compact",
  children,
}: Props) {
  const [g0, g1, g2] = style.gradient;
  const fallbackBg = g2 ?? g1 ?? g0;
  const showBean = g0 !== "#F8F9FA" && g0 !== "#F2A88E";
  // Glow colour matches the tier accent — gold on Platinum, white-ish on Silver, etc.
  const glowColor = style.accentColor;

  return (
    <View
      style={{
        paddingTop,
        paddingBottom,
        paddingHorizontal: 16,
        backgroundColor: fallbackBg,
        minHeight: variant === "tall" ? 200 : 110,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Svg
        height="100%"
        width="100%"
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgLinearGradient id="tierGrad" x1="0" y1="0" x2="0.3" y2="1">
            {g2
              ? [
                  <Stop key="0" offset="0" stopColor={g0} />,
                  <Stop key="1" offset="0.55" stopColor={g1} />,
                  <Stop key="2" offset="1" stopColor={g2} />,
                ]
              : [
                  <Stop key="0" offset="0" stopColor={g0} />,
                  <Stop key="1" offset="1" stopColor={g1} />,
                ]}
          </SvgLinearGradient>
          <SvgRadialGradient id="tierGlow" cx="90%" cy="0%" rx="70%" ry="80%">
            <Stop offset="0" stopColor={glowColor} stopOpacity="0.18" />
            <Stop offset="1" stopColor={glowColor} stopOpacity="0" />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tierGrad)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tierGlow)" />
        {showBean ? (
          <>
            <Ellipse
              cx={SCREEN_W * 0.92}
              cy={70}
              rx={48}
              ry={68}
              fill="rgba(180, 140, 80, 0.13)"
              transform={`rotate(-22 ${SCREEN_W * 0.92} 70)`}
            />
            <Ellipse
              cx={SCREEN_W * 0.15}
              cy={140}
              rx={26}
              ry={38}
              fill="rgba(180, 140, 80, 0.08)"
              transform={`rotate(35 ${SCREEN_W * 0.15} 140)`}
            />
          </>
        ) : null}
      </Svg>

      {children}
    </View>
  );
}
