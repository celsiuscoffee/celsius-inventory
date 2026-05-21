import { useState } from "react";
import { View, Text, Platform } from "react-native";
import { SvgUri } from "react-native-svg";
import { Wallet, CreditCard } from "lucide-react-native";

// Per-method visual identity for the checkout tiles.
//
// For methods that have an officially-distributed SVG on the Simple Icons
// CDN (CC0-licensed brand mark hosting), we render the real logo through
// SvgUri. For methods that don't, we fall back to a brand-color chip with
// a short monogram. The chip background stays the same in both cases so
// the row layout never shifts when the network fetch finishes.
//
// Simple Icons URL format: https://cdn.simpleicons.org/<slug>/<hexColor>
type Brand = {
  bg:        string;
  fg:        string;
  label:     string;
  iconSlug?: string;
  iconFg?:   string;
  border?:   string;
};

const BRANDS: Record<string, Brand> = {
  apple_pay:  { bg: "#000000", fg: "#FFFFFF", label: "Pay",   iconSlug: "applepay", iconFg: "FFFFFF" },
  google_pay: { bg: "#FFFFFF", fg: "#3C4043", label: "GPay",  iconSlug: "googlepay", border: "#E5E7EB" },
  fpx:        { bg: "#1B7A8F", fg: "#FFFFFF", label: "FPX"   },
  grabpay:    { bg: "#00B14F", fg: "#FFFFFF", label: "Grab",  iconSlug: "grab", iconFg: "FFFFFF" },
  tng:        { bg: "#005AAA", fg: "#FFD400", label: "tng"   },
  // Simple Icons' "boost" slug is the international/Boost Mobile mark,
  // not the Malaysian Boost (My Boost Sdn Bhd) the user is paying with.
  // Stick with the brand-color monogram chip until we have the right
  // asset from myboost.co/media-kit.
  boost:      { bg: "#EC008C", fg: "#FFFFFF", label: "Boost" },
  shopeepay:  { bg: "#EE4D2D", fg: "#FFFFFF", label: "Pay",   iconSlug: "shopee", iconFg: "FFFFFF" },
};

type Props = {
  methodId: string;
  size?:    number;
};

// Card chip — generic credit-card glyph on the brand navy. Stays
// network-agnostic (no Visa / Mastercard marks) so the tile doesn't
// imply any specific network is accepted on its own.
function CardChip({ size }: { size: number }) {
  const radius = Math.round(size * 0.28);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: "#0B1A4A",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CreditCard size={Math.round(size * 0.55)} color="#FFFFFF" strokeWidth={2} />
    </View>
  );
}

// Group icon for the E-Wallet category — generic wallet glyph on the
// brand primary background. Used when no specific wallet is picked yet
// so the tile doesn't visually favour one wallet over the others.
function EWalletGroupChip({ size }: { size: number }) {
  const radius = Math.round(size * 0.28);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: "#C05040",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Wallet size={Math.round(size * 0.55)} color="#FFFFFF" strokeWidth={2} />
    </View>
  );
}

export function PaymentBrandIcon({ methodId, size = 36 }: Props) {
  // Composite renderers — must come before the BRANDS lookup since
  // they don't have a single iconSlug or monogram.
  if (methodId === "card")    return <CardChip size={size} />;
  if (methodId === "ewallet") return <EWalletGroupChip size={size} />;

  const brand = BRANDS[methodId];
  const radius = Math.round(size * 0.28);
  const [iconFailed, setIconFailed] = useState(false);

  if (!brand) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: "#F2E9DD",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Wallet size={Math.round(size * 0.5)} color="#C05040" strokeWidth={2} />
      </View>
    );
  }

  const inner = (() => {
    if (brand.iconSlug && !iconFailed) {
      const tint = brand.iconFg ?? brand.fg.replace("#", "");
      const iconSize = Math.round(size * 0.6);
      return (
        <SvgUri
          width={iconSize}
          height={iconSize}
          uri={`https://cdn.simpleicons.org/${brand.iconSlug}/${tint}`}
          onError={() => setIconFailed(true)}
        />
      );
    }
    return (
      <Text
        style={{
          color: brand.fg,
          fontSize: Math.round(size * (brand.label.length > 3 ? 0.28 : 0.36)),
          fontFamily: "Peachi-Bold",
          letterSpacing: -0.3,
          lineHeight: Platform.OS === "ios" ? Math.round(size * 0.38) : undefined,
        }}
      >
        {brand.label}
      </Text>
    );
  })();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: brand.bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: brand.border ? 1 : 0,
        borderColor: brand.border,
      }}
    >
      {inner}
    </View>
  );
}
