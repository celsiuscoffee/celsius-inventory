/**
 * Voucher detail — opened from the wallet on the Rewards screen.
 *
 * Matches the app's visual vocabulary: EspressoHeader, PrimaryButton CTA,
 * rounded-2xl cards with brand border, Peachi headings, Space Grotesk body.
 * No QR — vouchers apply automatically at checkout.
 */

import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Croissant, Plus, Sparkles, Percent, Ticket, Info } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { EspressoHeader } from "../../components/EspressoHeader";
import { PrimaryButton } from "../../components/PrimaryButton";
import { fetchVoucher, type Voucher, voucherUrgencyLabel } from "../../lib/rewards-v2";
import { useApp, type AppliedReward } from "../../lib/store";

function mapDiscountType(t: NonNullable<Voucher["discount_type"]>): AppliedReward["discount_type"] {
  switch (t) {
    case "free_item":         return "free_item";
    case "free_upgrade":      return "free_item";
    case "flat":              return "flat";
    case "percent":           return "percent";
    case "beans_multiplier":  return "none";
    default:                  return "none";
  }
}

const CATEGORY_ICON: Record<Voucher["category"], React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  free_item:  Croissant,
  upgrade:    Plus,  // Celsius offers add-ons (extra shot, oat milk) — not size upgrades
  discount:   Percent,
  multiplier: Sparkles,
  special:    Ticket,
};

const SOURCE_LABEL: Record<NonNullable<Voucher["source_type"]>, string> = {
  mission:           "Challenge reward",
  mystery:           "Mystery Bean",
  birthday:          "Birthday treat",
  referral:          "Referral bonus",
  milestone:         "Milestone",
  manual:            "Granted by team",
  points_redemption: "Points redemption",
};

export default function VoucherDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setReservedVoucher = useApp((s) => s.setReservedVoucher);
  const setAppliedReward = useApp((s) => s.setAppliedReward);

  const { data: voucher, isLoading } = useQuery({
    queryKey: ["voucher", id],
    queryFn: () => fetchVoucher(id),
    enabled: !!id,
  });

  if (isLoading || !voucher) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
        <EspressoHeader title="Voucher" showBack showCart={false} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C05040" />
        </View>
      </View>
    );
  }

  const Icon = CATEGORY_ICON[voucher.category] ?? Ticket;
  const urgency = voucherUrgencyLabel(voucher);

  // Auto-issued (mission/mystery/birthday/milestone/referral) → espresso/amber hero
  // Points-redemption / manual → terracotta/white hero
  const isAutoIssued = ["birthday", "mission", "mystery", "milestone", "referral"].includes(
    voucher.source_type ?? ""
  );
  const heroBg = isAutoIssued ? "#1A0200" : "#C05040";
  const heroAccent = isAutoIssued ? "#FBBF24" : "#FFFFFF";
  const heroIconBg = isAutoIssued ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.18)";

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <EspressoHeader title="Voucher" showBack showCart={false} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          className="rounded-2xl px-5 py-6 items-center"
          style={{
            backgroundColor: heroBg,
            shadowColor: "#1A0200",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 5,
          }}
        >
          <View
            className="rounded-2xl items-center justify-center mb-3.5"
            style={{ width: 64, height: 64, backgroundColor: heroIconBg }}
          >
            <Icon size={32} color={heroAccent} strokeWidth={1.8} />
          </View>
          <Text
            className="text-[10px] uppercase mb-1"
            style={{
              fontFamily: "SpaceGrotesk_700Bold",
              letterSpacing: 2,
              color: heroAccent,
              opacity: 0.85,
            }}
          >
            Voucher
          </Text>
          <Text
            className="text-[24px] text-center"
            style={{
              fontFamily: "Peachi-Bold",
              color: heroAccent,
              letterSpacing: -0.5,
            }}
          >
            {voucher.title}
          </Text>
          <Text
            className="text-[13px] mt-2 text-center"
            style={{
              fontFamily: "SpaceGrotesk_500Medium",
              color: heroAccent,
              opacity: 0.8,
              lineHeight: 19,
            }}
          >
            {voucher.description}
          </Text>
        </View>

        {/* Metadata card — Card primitive */}
        <View
          className="mt-4 bg-surface rounded-2xl border border-border px-4"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          }}
        >
          <Row k="Earned from" v={voucher.source_type ? SOURCE_LABEL[voucher.source_type] : "—"} />
          <Row k="Expires" v={urgency.label} warn={urgency.warning} />
          <Row k="Stacks with Beans" v={voucher.stacks_with_beans ? "Yes" : "No"} />
          <Row
            k="Status"
            v={voucher.status === "active" ? "Ready to use" : voucher.status}
            last
          />
        </View>

        {/* How-to hint */}
        <View
          className="mt-4 rounded-2xl flex-row items-start p-3.5"
          style={{ backgroundColor: "#FBEBE8", gap: 10 }}
        >
          <Info size={18} color="#C05040" strokeWidth={2} style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text
              className="text-espresso text-[14px] mb-1"
              style={{ fontFamily: "Peachi-Bold" }}
            >
              How to use
            </Text>
            <Text
              className="text-muted-fg text-[12px]"
              style={{ fontFamily: "SpaceGrotesk_500Medium", lineHeight: 18 }}
            >
              Add items to your cart, then choose this voucher at checkout. It applies automatically — no code or scan needed.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA — routes to menu to start an order */}
      <View
        className="absolute left-0 right-0 px-4 pt-3 border-t border-border bg-background/95"
        style={{ bottom: 0, paddingBottom: insets.bottom + 12 }}
      >
        <PrimaryButton
          label="Use now · order"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (voucher) {
              setReservedVoucher({
                id: voucher.id,
                title: voucher.title,
                category: voucher.category,
                icon: voucher.icon,
                expires_at: voucher.expires_at,
              });
              if (voucher.discount_type) {
                setAppliedReward({
                  id: voucher.id,
                  name: voucher.title,
                  points_required: 0,
                  discount_type: mapDiscountType(voucher.discount_type),
                  discount_value: voucher.discount_value ?? null,
                  applicable_categories: voucher.applicable_categories ?? null,
                  applicable_products: voucher.applicable_products ?? null,
                  free_product_name: voucher.free_product_name ?? null,
                  min_order_value: voucher.min_order_value ?? null,
                  voucher_id: voucher.id,
                });
              }
            }
            router.push("/menu" as never);
          }}
        />
      </View>
    </View>
  );
}

function Row({ k, v, warn, last }: { k: string; v: string; warn?: boolean; last?: boolean }) {
  return (
    <View
      className="flex-row justify-between"
      style={{
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(26,2,0,0.06)",
      }}
    >
      <Text
        className="text-muted text-[13px]"
        style={{ fontFamily: "SpaceGrotesk_500Medium" }}
      >
        {k}
      </Text>
      <Text
        className="text-[13px]"
        style={{
          fontFamily: "SpaceGrotesk_600SemiBold",
          color: warn ? "#C05040" : "#1A0200",
          maxWidth: "60%",
          textAlign: "right",
        }}
      >
        {v}
      </Text>
    </View>
  );
}
