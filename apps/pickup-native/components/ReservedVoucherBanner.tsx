/**
 * ReservedVoucherBanner — sticky strip shown on the Menu / Cart screens
 * when the customer tapped "Use" on a voucher in their wallet.
 *
 * Renders nothing if no voucher is reserved. Lets the customer dismiss
 * (and clear the reservation) without leaving the screen.
 */

import { View, Text, Pressable } from "react-native";
import { Croissant, Plus, Sparkles, Percent, Ticket, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useApp, type ReservedVoucher } from "../lib/store";

const CATEGORY_ICON: Record<ReservedVoucher["category"], React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  free_item:  Croissant,
  upgrade:    Plus,  // Celsius offers add-ons (extra shot, oat milk) — not size upgrades
  discount:   Percent,
  multiplier: Sparkles,
  special:    Ticket,
};

export function ReservedVoucherBanner() {
  const reserved = useApp((s) => s.reservedVoucher);
  const setReservedVoucher = useApp((s) => s.setReservedVoucher);
  const appliedReward = useApp((s) => s.appliedReward);
  const setAppliedReward = useApp((s) => s.setAppliedReward);

  if (!reserved) return null;

  const Icon = CATEGORY_ICON[reserved.category] ?? Ticket;

  function dismiss() {
    Haptics.selectionAsync();
    setReservedVoucher(null);
    // Also clear the applied reward if it's THIS voucher — preserve any
    // points-shop reward the customer applied separately (different id).
    if (appliedReward?.voucher_id && appliedReward.voucher_id === reserved?.id) {
      setAppliedReward(null);
    }
  }

  return (
    <View
      style={{
        backgroundColor: "#FBEBE8",
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(192,80,64,0.18)",
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: "#C05040",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color="#FFFFFF" strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "Peachi-Bold",
            fontSize: 13,
            color: "#1A0200",
          }}
          numberOfLines={1}
        >
          {reserved.title} locked in
        </Text>
        <Text
          style={{
            fontFamily: "SpaceGrotesk_500Medium",
            fontSize: 11,
            color: "#5A1F16",
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          Add items — applies at checkout
        </Text>
      </View>
      <Pressable
        onPress={dismiss}
        hitSlop={12}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "rgba(26,2,0,0.08)",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel="Remove reserved voucher"
      >
        <X size={14} color="#5A1F16" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}
