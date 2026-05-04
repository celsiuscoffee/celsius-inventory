import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Coffee, ShoppingBag } from "lucide-react-native";
import { fetchOrder } from "../../lib/menu";
import { formatPrice } from "../../lib/api";
import { EspressoHeader } from "../../components/EspressoHeader";

const STATUS_STEPS: Array<{
  key: string;
  title: string;
  sub: string;
  icon: any;
}> = [
  { key: "paid", title: "Order received", sub: "We'll start preparing", icon: ShoppingBag },
  { key: "preparing", title: "Preparing", sub: "Your drinks are being made", icon: Coffee },
  { key: "ready", title: "Ready for pickup", sub: "Show this screen at the counter", icon: CheckCircle2 },
];

const STATUS_INDEX: Record<string, number> = {
  pending: -1,
  paid: 0,
  preparing: 1,
  ready: 2,
  completed: 2,
};

export default function OrderStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    refetchInterval: 5000,
    enabled: !!id,
  });

  const statusIdx = STATUS_INDEX[data?.status ?? "pending"] ?? -1;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader
        title={data ? `Order #${data.order_number}` : "Order"}
        showCart={false}
        rightSlot={
          <Pressable
            onPress={() => router.replace("/")}
            className="p-1 active:opacity-60"
            hitSlop={12}
          >
            <Text className="text-white text-2xl">×</Text>
          </Pressable>
        }
      />

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C05040" />
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-muted-fg text-center">Couldn't load order.</Text>
        </View>
      )}

      {data && (
        <ScrollView contentContainerClassName="px-4 py-4 pb-12 gap-4">
          {/* Status timeline */}
          <View
            className="bg-surface rounded-2xl border border-border p-5"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {data.status === "pending" ? (
              <View className="items-center py-2">
                <Clock size={28} color="#C05040" />
                <Text
                  className="text-espresso text-lg mt-2"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  Awaiting payment
                </Text>
                <Text className="text-muted-fg text-sm mt-1">
                  Complete payment to start preparing
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {STATUS_STEPS.map((step, i) => {
                  const done = i < statusIdx;
                  const current = i === statusIdx;
                  const Icon = step.icon;
                  return (
                    <View key={step.key} className="flex-row items-start gap-3">
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center ${
                          done
                            ? "bg-primary/15"
                            : current
                            ? "bg-primary"
                            : "bg-background border border-border"
                        }`}
                      >
                        <Icon
                          size={18}
                          color={current ? "#FFFFFF" : done ? "#C05040" : "#8E8E93"}
                        />
                      </View>
                      <View className="flex-1 pt-1">
                        <Text
                          className={`font-bold ${
                            current ? "text-primary" : done ? "text-espresso" : "text-muted-fg"
                          }`}
                        >
                          {step.title}
                        </Text>
                        <Text
                          className={`text-xs mt-0.5 ${
                            current ? "text-primary/70" : "text-muted-fg"
                          }`}
                        >
                          {step.sub}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Order summary */}
          <View className="bg-surface rounded-2xl border border-border p-4">
            <Text className="text-muted-fg text-[10px] font-bold uppercase tracking-widest">
              Items
            </Text>
            <View className="mt-2 gap-1.5">
              {Array.isArray(data.items) &&
                (data.items as any[]).map((i, idx) => (
                  <View key={idx} className="flex-row justify-between">
                    <Text className="text-espresso flex-1">
                      {i.quantity}× {i.name}
                    </Text>
                    <Text className="text-espresso">{formatPrice(i.totalPrice ?? 0)}</Text>
                  </View>
                ))}
              <View className="flex-row justify-between mt-3 pt-3 border-t border-border">
                <Text className="text-espresso font-bold">Total</Text>
                <Text
                  className="text-primary"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  {formatPrice(data.total ?? 0)}
                </Text>
              </View>
            </View>
          </View>

          {data.status === "ready" && (
            <View className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
              <Text className="text-primary text-sm font-bold">Show this to the barista</Text>
              <Text className="text-primary/80 text-xs mt-1">
                Your order #{data.order_number} is ready for pickup.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
