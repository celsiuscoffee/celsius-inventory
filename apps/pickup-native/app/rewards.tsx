import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Lock, Sparkles, ChevronRight } from "lucide-react-native";
import { EspressoHeader } from "../components/EspressoHeader";
import { BottomNav } from "../components/BottomNav";
import * as Haptics from "expo-haptics";
import { useApp } from "../lib/store";
import { fetchRewards, formatRewardValue, type Reward } from "../lib/rewards";

export default function RewardsTab() {
  const phone = useApp((s) => s.phone);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["rewards", phone ?? "anonymous"],
    queryFn: () => fetchRewards(phone),
    staleTime: 30_000,
  });

  const balance = data?.pointsBalance ?? 0;
  const rewards = data?.rewards ?? [];

  const { claimable, locked } = useMemo(() => {
    const sorted = [...rewards].sort(
      (a, b) => a.points_required - b.points_required
    );
    return {
      claimable: sorted.filter((r) => balance >= r.points_required),
      locked: sorted.filter((r) => balance < r.points_required),
    };
  }, [rewards, balance]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Rewards" showCart={false} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-32"
        showsVerticalScrollIndicator={false}
      >
        {!phone ? (
          <SignInPrompt />
        ) : (
          <>
            <BalanceHero balance={balance} memberId={data?.memberId ?? null} loading={isLoading} />

            {isLoading && rewards.length === 0 && (
              <View className="py-12 items-center">
                <ActivityIndicator color="#C05040" />
              </View>
            )}

            {claimable.length > 0 && (
              <Section title="Ready to claim" icon={Sparkles}>
                {claimable.map((r) => (
                  <ClaimableRewardRow key={r.id} reward={r} balance={balance} />
                ))}
              </Section>
            )}

            {locked.length > 0 && (
              <Section title="Earn more" icon={Lock}>
                {locked.map((r) => (
                  <RewardRow key={r.id} reward={r} canClaim={false} balance={balance} />
                ))}
              </Section>
            )}

            {!isLoading && rewards.length === 0 && (
              <View className="px-6 py-12 items-center">
                <Gift size={40} color="#C05040" strokeWidth={1.25} />
                <Text
                  className="text-espresso text-base mt-3"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  No rewards yet
                </Text>
                <Text
                  className="text-muted-fg text-sm text-center mt-1"
                  style={{ fontFamily: "SpaceGrotesk_400Regular" }}
                >
                  Check back soon — new rewards drop regularly.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

function BalanceHero({
  balance,
  memberId,
  loading,
}: {
  balance: number;
  memberId: string | null;
  loading: boolean;
}) {
  return (
    <View className="mx-4 mt-4 rounded-3xl bg-espresso p-5">
      <Text
        className="text-white/60 text-[11px] tracking-widest uppercase"
        style={{ fontFamily: "SpaceGrotesk_600SemiBold" }}
      >
        Your balance
      </Text>
      <View className="flex-row items-baseline mt-1">
        <Text
          className="text-white text-[44px] leading-[48px]"
          style={{ fontFamily: "Peachi-Bold" }}
        >
          {loading ? "—" : balance.toLocaleString()}
        </Text>
        <Text
          className="text-white/70 text-base ml-2"
          style={{ fontFamily: "SpaceGrotesk_500Medium" }}
        >
          pts
        </Text>
      </View>
      {!memberId && !loading && (
        <Text
          className="text-white/60 text-xs mt-2"
          style={{ fontFamily: "SpaceGrotesk_400Regular" }}
        >
          We don't see an account for this phone yet — earn points on your next order to unlock rewards.
        </Text>
      )}
    </View>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6 px-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Icon size={14} color="#160800" strokeWidth={2} />
        <Text
          className="text-espresso text-[11px] tracking-widest uppercase"
          style={{ fontFamily: "SpaceGrotesk_700Bold" }}
        >
          {title}
        </Text>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function RewardRow({
  reward,
  canClaim,
  balance,
}: {
  reward: Reward;
  canClaim: boolean;
  balance: number;
}) {
  const pointsShort = Math.max(0, reward.points_required - balance);
  return (
    <Pressable
      className={`bg-surface rounded-2xl border border-border p-3 flex-row items-center gap-3 active:opacity-70 ${
        canClaim ? "" : "opacity-70"
      }`}
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {reward.image_url ? (
        <Image
          source={{ uri: reward.image_url }}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="bg-primary/10 items-center justify-center"
          style={{ width: 56, height: 56, borderRadius: 12 }}
        >
          <Gift size={24} color="#C05040" strokeWidth={1.5} />
        </View>
      )}
      <View className="flex-1">
        <Text
          className="text-espresso text-[15px]"
          style={{ fontFamily: "Peachi-Bold" }}
          numberOfLines={1}
        >
          {reward.name}
        </Text>
        <Text
          className="text-muted-fg text-[12px] mt-0.5"
          style={{ fontFamily: "SpaceGrotesk_400Regular" }}
          numberOfLines={1}
        >
          {formatRewardValue(reward)}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`text-[13px] ${canClaim ? "text-primary" : "text-muted-fg"}`}
          style={{ fontFamily: "Peachi-Bold" }}
        >
          {reward.points_required} pts
        </Text>
        {!canClaim && (
          <Text
            className="text-muted-fg text-[10px] mt-0.5"
            style={{ fontFamily: "SpaceGrotesk_500Medium" }}
          >
            {pointsShort} to go
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function ClaimableRewardRow({ reward, balance }: { reward: Reward; balance: number }) {
  const appliedReward = useApp((s) => s.appliedReward);
  const setAppliedReward = useApp((s) => s.setAppliedReward);
  const cart = useApp((s) => s.cart);
  const isApplied = appliedReward?.id === reward.id;

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAppliedReward({
      id: reward.id,
      name: reward.name,
      points_required: reward.points_required,
      discount_type: reward.discount_type,
      discount_value: reward.discount_value,
      bogo_buy_qty: reward.bogo_buy_qty,
      bogo_free_qty: reward.bogo_free_qty,
      free_product_name: reward.free_product_name,
    });
    if (cart.length > 0) router.push("/cart");
  };

  return (
    <Pressable
      onPress={handleApply}
      disabled={isApplied}
      className="bg-surface rounded-2xl border border-border p-3 flex-row items-center gap-3 active:opacity-70"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {reward.image_url ? (
        <Image
          source={{ uri: reward.image_url }}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="bg-primary/10 items-center justify-center"
          style={{ width: 56, height: 56, borderRadius: 12 }}
        >
          <Gift size={24} color="#C05040" strokeWidth={1.5} />
        </View>
      )}
      <View className="flex-1">
        <Text
          className="text-espresso text-[15px]"
          style={{ fontFamily: "Peachi-Bold" }}
          numberOfLines={1}
        >
          {reward.name}
        </Text>
        <Text
          className="text-muted-fg text-[12px] mt-0.5"
          style={{ fontFamily: "SpaceGrotesk_400Regular" }}
          numberOfLines={1}
        >
          {formatRewardValue(reward)} · {reward.points_required} pts
        </Text>
      </View>
      <View
        className={`rounded-full items-center justify-center ${
          isApplied ? "bg-green-600" : "bg-espresso"
        }`}
        style={{ paddingHorizontal: 14, paddingVertical: 8 }}
      >
        <Text
          className="text-white text-[12px]"
          style={{ fontFamily: "Peachi-Bold" }}
        >
          {isApplied ? "Applied" : "Apply"}
        </Text>
      </View>
    </Pressable>
  );
}

function SignInPrompt() {
  return (
    <View className="px-6 pt-12 items-center">
      <View
        className="bg-primary/10 items-center justify-center mb-4"
        style={{ width: 72, height: 72, borderRadius: 36 }}
      >
        <Gift size={32} color="#C05040" strokeWidth={1.5} />
      </View>
      <Text
        className="text-espresso text-xl text-center"
        style={{ fontFamily: "Peachi-Bold" }}
      >
        Earn on every cup
      </Text>
      <Text
        className="text-muted-fg text-sm text-center mt-2 max-w-xs"
        style={{ fontFamily: "SpaceGrotesk_400Regular" }}
      >
        Add your phone to start collecting points and unlock free drinks, fries, and more.
      </Text>
      <Pressable
        onPress={() => router.push("/account")}
        className="mt-6 bg-espresso rounded-full active:opacity-80 flex-row items-center"
        style={{ paddingHorizontal: 20, paddingVertical: 12 }}
      >
        <Text
          className="text-white text-[15px] mr-2"
          style={{ fontFamily: "Peachi-Bold" }}
        >
          Sign in
        </Text>
        <ChevronRight size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
