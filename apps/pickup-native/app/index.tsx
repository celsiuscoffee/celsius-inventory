import { View, Text, ActivityIndicator, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { MapPin, Clock, ChevronRight, Coffee, Navigation } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { supabase, type Outlet } from "../lib/supabase";
import { useApp, cartCount } from "../lib/store";
import { fetchMenu } from "../lib/menu";
import { EspressoHeader } from "../components/EspressoHeader";
import { Card } from "../components/Card";
import { BottomNav } from "../components/BottomNav";
import { formatPrice } from "../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

async function fetchOutlets(): Promise<Outlet[]> {
  const { data, error } = await supabase
    .from("outlet_settings")
    .select("store_id,name,address,lat,lng,is_open,is_busy,pickup_time_mins")
    .eq("is_active", true)
    .order("store_id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const outlets = useQuery({ queryKey: ["outlets"], queryFn: fetchOutlets });
  const menu = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const outletId = useApp((s) => s.outletId);
  const outletName = useApp((s) => s.outletName);
  const cart = useApp((s) => s.cart);
  const setOutlet = useApp((s) => s.setOutlet);

  const featured = (menu.data?.products ?? [])
    .filter((p) => p.is_featured && p.is_available)
    .slice(0, 6);

  const onOrderNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (cartCount(cart) > 0) router.push("/cart");
    else if (outletId) router.push("/menu");
    else router.push("/store");
  };

  return (
    <View className="flex-1 bg-background">
      <EspressoHeader />

      {/* Brand block inside header (we don't show title there since we're showing logo here) */}
      <View className="bg-espresso -mt-5 px-4 pb-5">
        <Text
          className="text-white text-2xl"
          style={{ fontFamily: "Peachi-Bold" }}
        >
          Celsius Coffee
        </Text>
        <Text className="text-white/50 text-[10px] mt-0.5 tracking-wide">
          Pickup only · Order ahead
        </Text>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/store");
          }}
          className="flex-row items-center gap-1.5 mt-4 active:opacity-70"
        >
          <MapPin size={14} color="rgba(255,255,255,0.7)" />
          <Text className="text-white text-sm font-bold flex-1">
            {outletName ?? "Select pickup outlet"}
          </Text>
          <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="pb-40">
        {/* Hero promo */}
        <View className="bg-espresso mx-0 relative overflow-hidden">
          <View className="px-5 pt-6 pb-7">
            <Text className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              New App Promo
            </Text>
            <View className="flex-row items-end gap-3 mt-1">
              <Text
                className="text-white text-5xl leading-none"
                style={{ fontFamily: "Peachi-Bold" }}
              >
                Buy 1{"\n"}
                <Text className="text-amber-400">Free 1</Text>
              </Text>
            </View>
            <Text className="text-white/60 text-sm mt-2">
              First app order · Any drink · Any size
            </Text>
            <Pressable
              onPress={onOrderNow}
              className="self-start mt-4 bg-white rounded-full px-5 py-2.5 flex-row items-center gap-1.5 active:opacity-80"
            >
              <Text className="text-primary text-sm font-bold">Order Now</Text>
              <ChevronRight size={16} color="#C05040" />
            </Pressable>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row gap-3 px-4 mt-4">
          <View className="flex-1">
            <Card onPress={onOrderNow}>
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <Coffee size={20} color="#C05040" strokeWidth={1.5} />
              </View>
              <Text className="text-espresso font-bold text-sm mt-2.5">
                {cartCount(cart) > 0 ? "Review Cart" : "Order Now"}
              </Text>
              <Text className="text-muted-fg text-xs mt-0.5">
                {cartCount(cart) > 0
                  ? `${cartCount(cart)} item${cartCount(cart) === 1 ? "" : "s"} waiting`
                  : "Browse full menu"}
              </Text>
            </Card>
          </View>
          <View className="flex-1">
            <Card onPress={() => router.push("/store")}>
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <Navigation size={20} color="#C05040" strokeWidth={1.5} />
              </View>
              <Text className="text-espresso font-bold text-sm mt-2.5">Our Outlets</Text>
              <Text className="text-muted-fg text-xs mt-0.5" numberOfLines={1}>
                Shah Alam · Conezion · Tamarind
              </Text>
            </Card>
          </View>
        </View>

        {/* Best Sellers */}
        {featured.length > 0 && (
          <View className="px-4 mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-espresso text-base"
                style={{ fontFamily: "Peachi-Bold" }}
              >
                Best Sellers
              </Text>
              <Pressable
                onPress={() => {
                  if (!outletId) router.push("/store");
                  else router.push("/menu");
                }}
                className="flex-row items-center gap-0.5 active:opacity-70"
              >
                <Text className="text-primary text-xs font-bold">More</Text>
                <ChevronRight size={14} color="#C05040" />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3"
            >
              {featured.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    if (!outletId) router.push("/store");
                    else router.push({ pathname: "/product/[id]", params: { id: p.id } });
                  }}
                  className="w-40 active:opacity-70"
                >
                  <View
                    className="bg-surface rounded-3xl overflow-hidden border border-border"
                    style={{
                      shadowColor: "#000",
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <View className="aspect-[3/4] bg-background">
                      {p.image_url && (
                        <Image
                          source={{ uri: p.image_url }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      )}
                    </View>
                    <View className="p-3">
                      <Text
                        className="text-espresso font-bold text-[13px]"
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                      <Text
                        className="text-primary font-black text-sm mt-1.5"
                        style={{ fontFamily: "Peachi-Bold" }}
                      >
                        {formatPrice(p.price)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {(outlets.isLoading || menu.isLoading) && (
          <View className="py-10 items-center">
            <ActivityIndicator color="#C05040" />
          </View>
        )}
      </ScrollView>

      {cartCount(cart) > 0 && (
        <View
          className="absolute left-4 right-4"
          style={{ bottom: insets.bottom + 70 }}
        >
          <Pressable
            onPress={() => router.push("/cart")}
            className="bg-primary rounded-full py-3 px-5 flex-row items-center justify-between active:opacity-80"
            style={{
              shadowColor: "#C05040",
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View className="flex-row items-center gap-2">
              <View className="bg-white rounded-full w-6 h-6 items-center justify-center">
                <Text className="text-primary text-xs font-bold">{cartCount(cart)}</Text>
              </View>
              <Text className="text-white font-bold">View cart</Text>
            </View>
            <Text className="text-white font-bold">
              {cartCount(cart)} item{cartCount(cart) > 1 ? "s" : ""}
            </Text>
          </Pressable>
        </View>
      )}

      <BottomNav />
    </View>
  );
}
