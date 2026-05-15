import { View, Dimensions } from "react-native";
import { Skeleton } from "./Skeleton";

/**
 * Layout-shaped skeleton for the tier card carousel. Matches the
 * EXACT dimensions and paddings of TierCardCarousel so the swap from
 * skeleton → real card is silent — no layout jump pushing the rest
 * of the page around when the data lands.
 *
 * Critical: TierCardCarousel renders at `Math.max(cardHeight, 232)`
 * when the `stats` prop is set (which it always is on the Account
 * screen). The default cardHeight in the carousel is 192, so the
 * effective height in account.tsx is 232. We mirror that as the
 * default here. If a screen renders the carousel without stats, pass
 * `height={192}` to match.
 *
 * Below the card, TierCardCarousel adds:
 *   - paddingBottom: 4 on the ScrollView contentContainer
 *   - 12px margin-top on the page indicator dots row
 *   - 6px tall pill dots
 * We mirror all three so the bottom of the skeleton lands at the
 * same Y as the bottom of the real component.
 */

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 32;
const CARD_H_WITH_STATS = 232; // matches TierCardCarousel's effectiveHeight

type Props = {
  /** Card height. Defaults to 232 (the with-stats height used on
   *  Account); pass 192 for screens that render the carousel
   *  without stats. */
  height?: number;
  /** How many pagination dots to render. The Celsius brand has 5
   *  tiers (Bronze → Silver → Gold → Black → Staff) so 5 is the
   *  realistic count. */
  dotCount?: number;
};

export function TierCardSkeleton({
  height = CARD_H_WITH_STATS,
  dotCount = 5,
}: Props = {}) {
  return (
    <View>
      {/* Card itself — exact CARD_W × height match. */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <Skeleton width={CARD_W} height={height} borderRadius={20} />
      </View>

      {/* Page indicator row. First dot is active (wider) to mirror the
          live state where one tier is highlighted as "current". */}
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          justifyContent: "center",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        {Array.from({ length: dotCount }, (_, i) => (
          <Skeleton
            key={i}
            width={i === 0 ? 14 : 6}
            height={6}
            borderRadius={3}
          />
        ))}
      </View>
    </View>
  );
}
