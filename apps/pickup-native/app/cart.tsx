import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { Stack, router } from "expo-router";
import { Trash2, Gift, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { useApp, cartTotal } from "../lib/store";
import { formatPrice } from "../lib/api";
import { calcRewardDiscount } from "../lib/rewards";
import { getSetting } from "../lib/settings";
import { EspressoHeader } from "../components/EspressoHeader";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const cart = useApp((s) => s.cart);
  const updateQuantity = useApp((s) => s.updateQuantity);
  const removeFromCart = useApp((s) => s.removeFromCart);
  const outletName = useApp((s) => s.outletName);
  const appliedReward = useApp((s) => s.appliedReward);
  const setAppliedReward = useApp((s) => s.setAppliedReward);

  const subtotal = cartTotal(cart);
  const discount = calcRewardDiscount(appliedReward, cart, subtotal);
  const grandTotal = Math.max(0, subtotal - discount);

  const [minOrder, setMinOrder] = useState(0);
  useEffect(() => {
    getSetting("min_order_value").then((s) => setMinOrder(s.rm));
  }, []);
  const belowMin = minOrder > 0 && subtotal < minOrder;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Your cart" subtitle={outletName ? `Pickup from ${outletName}` : undefined} showBack showCart={false} />

      {cart.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-muted-fg text-center">Your cart is empty.</Text>
          <Pressable
            onPress={() => router.replace("/menu")}
            className="mt-6 px-6 py-3 rounded-full bg-primary active:opacity-80"
          >
            <Text className="text-white font-bold">Browse menu</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerClassName="px-4 py-4 pb-40 gap-3">
            {cart.map((item) => (
              <View
                key={item.cartId}
                className="bg-surface rounded-2xl border border-border p-3 flex-row gap-3"
                style={{
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{ width: 72, height: 72, borderRadius: 14 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className="bg-background"
                    style={{ width: 72, height: 72, borderRadius: 14 }}
                  />
                )}

                <View className="flex-1 min-w-0">
                  <View className="flex-row justify-between items-start gap-2">
                    <Text
                      className="text-espresso text-[15px] flex-1"
                      style={{ fontFamily: "Peachi-Bold" }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="text-primary text-[14px]"
                      style={{ fontFamily: "Peachi-Bold" }}
                      numberOfLines={1}
                    >
                      {formatPrice(item.totalPrice)}
                    </Text>
                  </View>

                  {item.modifiers.length > 0 && (
                    <Text
                      className="text-muted-fg text-[12px] mt-0.5"
                      style={{ fontFamily: "SpaceGrotesk_400Regular" }}
                      numberOfLines={2}
                    >
                      {item.modifiers.map((m) => m.label).join(" · ")}
                    </Text>
                  )}
                  {item.specialInstructions && (
                    <Text
                      className="text-muted-fg text-[11px] mt-0.5 italic"
                      style={{ fontFamily: "SpaceGrotesk_400Regular" }}
                      numberOfLines={1}
                    >
                      Note: {item.specialInstructions}
                    </Text>
                  )}

                  <View className="flex-row justify-between items-center mt-2">
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          updateQuantity(item.cartId, item.quantity - 1);
                        }}
                        className="w-7 h-7 rounded-full bg-background border border-border items-center justify-center active:opacity-70"
                        hitSlop={6}
                      >
                        <Text className="text-espresso">−</Text>
                      </Pressable>
                      <Text className="text-espresso w-5 text-center font-bold">
                        {item.quantity}
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          updateQuantity(item.cartId, item.quantity + 1);
                        }}
                        className="w-7 h-7 rounded-full bg-espresso items-center justify-center active:opacity-70"
                        hitSlop={6}
                      >
                        <Text className="text-white">+</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        removeFromCart(item.cartId);
                      }}
                      className="active:opacity-70 p-1"
                      hitSlop={8}
                    >
                      <Trash2 size={16} color="#8E8E93" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 px-4 pt-3 bg-background border-t border-border"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            {appliedReward ? (
              <View className="bg-primary/10 rounded-xl px-3 py-2 mb-3 flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Gift size={14} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-primary text-[13px]"
                    style={{ fontFamily: "Peachi-Bold" }}
                    numberOfLines={1}
                  >
                    {appliedReward.name}
                  </Text>
                  <Text
                    className="text-primary/80 text-[11px]"
                    style={{ fontFamily: "SpaceGrotesk_500Medium" }}
                  >
                    {appliedReward.points_required} pts · −{formatPrice(discount)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAppliedReward(null);
                  }}
                  hitSlop={8}
                  className="active:opacity-70"
                >
                  <X size={16} color="#C05040" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/rewards");
                }}
                className="bg-surface border border-dashed border-primary/40 rounded-xl px-3 py-2 mb-3 flex-row items-center gap-2 active:opacity-70"
              >
                <Gift size={16} color="#C05040" strokeWidth={1.75} />
                <Text
                  className="text-primary text-[13px] flex-1"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  Apply a reward
                </Text>
              </Pressable>
            )}

            <View className="mb-1 flex-row justify-between items-center">
              <Text className="text-muted-fg text-[13px]">Subtotal</Text>
              <Text
                className="text-espresso text-[14px]"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                {formatPrice(subtotal)}
              </Text>
            </View>
            {discount > 0 && (
              <View className="mb-1 flex-row justify-between items-center">
                <Text className="text-primary text-[13px]">Reward discount</Text>
                <Text
                  className="text-primary text-[14px]"
                  style={{ fontFamily: "SpaceGrotesk_500Medium" }}
                >
                  −{formatPrice(discount)}
                </Text>
              </View>
            )}
            <View className="mb-3 flex-row justify-between items-center">
              <Text className="text-espresso text-[15px]" style={{ fontFamily: "Peachi-Bold" }}>
                Total
              </Text>
              <Text
                className="text-espresso text-lg"
                style={{ fontFamily: "Peachi-Bold" }}
              >
                {formatPrice(grandTotal)}
              </Text>
            </View>
            {belowMin && (
              <Text
                className="text-primary text-[12px] text-center mb-2"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                Add {formatPrice(minOrder - subtotal)} more to checkout (min {formatPrice(minOrder)})
              </Text>
            )}
            <Pressable
              disabled={belowMin}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/checkout");
              }}
              className={`rounded-full py-4 items-center ${
                belowMin ? "bg-primary/40" : "bg-primary active:opacity-80"
              }`}
            >
              <Text className="text-white font-bold text-base">Continue to checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
