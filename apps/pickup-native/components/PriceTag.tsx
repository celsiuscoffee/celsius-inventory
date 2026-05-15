import { View, Text, type TextStyle } from "react-native";
import { formatPrice } from "../lib/api";
import type { SaleResult } from "../lib/product-sales";

/**
 * Price renderer that handles the on-sale case automatically. Used
 * on the menu list, product detail, and pair-with cards so the same
 * strikethrough + sale-price treatment is consistent everywhere.
 *
 * No sale: renders just the price.
 * With sale: renders strikethrough base price + new effective price
 * in the brand red, plus an optional "-X%" / "-RMX" badge.
 */

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { base: number; old: number; gap: number }> = {
  sm: { base: 12, old: 11, gap: 4 },
  md: { base: 14, old: 12, gap: 6 },
  lg: { base: 20, old: 14, gap: 8 },
};

type Props = {
  basePrice: number;
  sale: SaleResult | null;
  size?: Size;
  /** When true, lay out price + strikethrough side-by-side (the
   *  default). When false, stack vertically — used on the product
   *  detail hero where vertical room is plentiful. */
  inline?: boolean;
  /** Override the colour for the active (post-sale or base) price. */
  color?: string;
  /** Style override for the active price text. */
  style?: TextStyle;
  /** Hide the "-X% off" badge — useful in tight spots like pair-with
   *  cards where the strikethrough alone communicates the deal. */
  hideBadge?: boolean;
};

export function PriceTag({
  basePrice,
  sale,
  size = "md",
  inline = true,
  color,
  style,
  hideBadge,
}: Props) {
  const s = SIZE[size];

  if (!sale) {
    return (
      <Text
        className="text-primary"
        style={[{ fontSize: s.base, fontFamily: "Peachi-Bold", color: color ?? undefined }, style]}
      >
        {formatPrice(basePrice)}
      </Text>
    );
  }

  const badge = sale.sale.discount_type === "percentage_off"
    ? `-${Math.round(sale.sale.discount_value)}%`
    : `-${formatPrice(sale.savings).replace(/^RM ?/, "RM")}`;

  return (
    <View style={{
      flexDirection: inline ? "row" : "column",
      alignItems: inline ? "baseline" : "flex-start",
      gap: s.gap,
    }}>
      <Text
        className="text-primary"
        style={[{ fontSize: s.base, fontFamily: "Peachi-Bold", color: color ?? undefined }, style]}
      >
        {formatPrice(sale.effective_price)}
      </Text>
      <Text
        className="text-muted-fg"
        style={{
          fontSize: s.old,
          fontFamily: "SpaceGrotesk_500Medium",
          textDecorationLine: "line-through",
        }}
      >
        {formatPrice(basePrice)}
      </Text>
      {!hideBadge && (
        <View
          style={{
            backgroundColor: "#16A34A",
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 6,
          }}
        >
          <Text
            className="text-white"
            style={{ fontSize: 10, fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 0.3 }}
          >
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}
