import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "./Skeleton";

/**
 * Layout-shaped skeleton for the product detail page. Mirrors the
 * real screen's structure (hero → title bar → price → 2 modifier
 * groups → bottom CTA) so the user sees the page "appear" with
 * actual shape, not a centred spinner. The eye reads the layout
 * immediately and perceived load time drops sharply.
 *
 * Used in place of the full-screen CelsiusLoader while the menu
 * fetch is in flight — typically <1 second on Wi-Fi but enough to
 * read as a meaningful pause if all the user sees is a spinner.
 */
export function ProductPageSkeleton() {
  const insets = useSafeAreaInsets();
  const { height: screenH, width: screenW } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Hero placeholder — same dimensions as the real product image. */}
      <Skeleton width={screenW} height={screenH * 0.5} borderRadius={0} />

      {/* Body — sits under the hero, mirrors the real layout. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 12 }}>
        {/* Product title */}
        <Skeleton width={"60%"} height={28} pill />
        {/* Description (2 lines) */}
        <View style={{ gap: 8, marginTop: 4 }}>
          <Skeleton width={"95%"} height={12} pill />
          <Skeleton width={"75%"} height={12} pill />
        </View>
        {/* Price */}
        <Skeleton width={80} height={20} pill style={{ marginTop: 8 }} />

        {/* First modifier group */}
        <View style={{ gap: 8, marginTop: 24 }}>
          <Skeleton width={120} height={10} pill />
          <Skeleton width={"100%"} height={48} borderRadius={16} />
          <Skeleton width={"100%"} height={48} borderRadius={16} />
        </View>

        {/* Second modifier group */}
        <View style={{ gap: 8, marginTop: 24 }}>
          <Skeleton width={140} height={10} pill />
          <Skeleton width={"100%"} height={48} borderRadius={16} />
          <Skeleton width={"100%"} height={48} borderRadius={16} />
        </View>
      </View>

      {/* Bottom CTA bar mock — pinned to the bottom like the real one. */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "rgba(26,8,0,0.10)",
        }}
      >
        <Skeleton width={"100%"} height={56} borderRadius={28} />
      </View>
    </View>
  );
}
