/**
 * Mission Picker — weekly picker modal.
 *
 * Matches the app's visual vocabulary: EspressoHeader, PrimaryButton CTA,
 * rounded-2xl cards with brand border, Peachi headings, terracotta accents.
 */

import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Sun, RefreshCw, MapPin, Users as UsersIcon, Clock, Coffee, Sparkles,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { EspressoHeader } from "../components/EspressoHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { fetchMissionPool, pickMission, type Mission } from "../lib/rewards-v2";

const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  sun: Sun, refresh: RefreshCw, pin: MapPin, users: UsersIcon, clock: Clock,
  coffee: Coffee, sparkle: Sparkles,
};

const DIFF_STYLES: Record<Mission["difficulty"], { bg: string; text: string; label: string }> = {
  easy:   { bg: "#E6F1DD", text: "#2F6A18", label: "Easy" },
  medium: { bg: "#FDF3E0", text: "#8A6614", label: "Medium" },
  hard:   { bg: "#FBEBE8", text: "#5A1F16", label: "Hard" },
};

export default function MissionPickerScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["mission-pool"],
    queryFn: fetchMissionPool,
  });

  const pickMutation = useMutation({
    mutationFn: pickMission,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Refresh active mission + pool so the Rewards screen reflects the new pick
      // (also drops the chosen mission from cooldown-eligible pool on next open).
      qc.invalidateQueries({ queryKey: ["active-mission"] });
      qc.invalidateQueries({ queryKey: ["mission-pool"] });
      router.back();
    },
  });

  function toggleSelect(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => (prev === id ? null : id));
  }

  const selectedMission = missions.find((m) => m.id === selected);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <EspressoHeader title="Pick your challenge" subtitle="This Week" showBack showCart={false} />

      {/* Intro copy */}
      <View className="px-4 pt-4 pb-2">
        <Text
          className="text-muted-fg text-[13px]"
          style={{ fontFamily: "SpaceGrotesk_500Medium", lineHeight: 19 }}
        >
          One mission per week — you choose. Complete by Sunday and your vouchers drop into your wallet.
        </Text>
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C05040" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
        >
          {missions.map((m) => {
            const Icon = ICON_MAP[m.icon] ?? Sparkles;
            const isSelected = selected === m.id;
            const diff = DIFF_STYLES[m.difficulty];

            return (
              <Pressable
                key={m.id}
                onPress={() => toggleSelect(m.id)}
                className={`rounded-2xl mb-2.5 p-3.5 flex-row items-center active:opacity-80 ${
                  isSelected ? "border-2 border-primary" : "border border-border"
                }`}
                style={{
                  gap: 12,
                  backgroundColor: isSelected ? "#FBEBE8" : "#FFFFFF",
                  shadowColor: "#000",
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 1,
                }}
              >
                <View
                  className="rounded-xl items-center justify-center"
                  style={{
                    width: 46,
                    height: 46,
                    backgroundColor: isSelected ? "#C05040" : "#FBEBE8",
                  }}
                >
                  <Icon
                    size={22}
                    color={isSelected ? "#FFFFFF" : "#C05040"}
                    strokeWidth={1.8}
                  />
                </View>

                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center mb-1" style={{ gap: 7 }}>
                    <Text
                      className="text-espresso text-[15px] flex-shrink"
                      style={{ fontFamily: "Peachi-Bold" }}
                    >
                      {m.title}
                    </Text>
                    <View
                      className="rounded"
                      style={{
                        backgroundColor: diff.bg,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "SpaceGrotesk_700Bold",
                          fontSize: 9,
                          color: diff.text,
                          letterSpacing: 0.7,
                          textTransform: "uppercase",
                        }}
                      >
                        {diff.label}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-muted-fg text-[12px]"
                    style={{ fontFamily: "SpaceGrotesk_500Medium", lineHeight: 17 }}
                  >
                    {m.description}
                  </Text>
                  <Text
                    className="text-primary text-[11px] mt-1.5"
                    style={{ fontFamily: "SpaceGrotesk_600SemiBold" }}
                  >
                    🎫 {m.reward_summary}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => router.back()}
            className="py-3.5 items-center active:opacity-60"
          >
            <Text
              className="text-muted text-[12px] underline"
              style={{ fontFamily: "SpaceGrotesk_500Medium" }}
            >
              Skip this week
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Sticky CTA */}
      <View
        className="absolute left-0 right-0 px-4 pt-3 border-t border-border bg-background/95"
        style={{ bottom: 0, paddingBottom: insets.bottom + 12 }}
      >
        <PrimaryButton
          label={selected ? `Lock in ${selectedMission?.title}` : "Pick a mission"}
          onPress={() => selected && pickMutation.mutate(selected)}
          loading={pickMutation.isPending}
          disabled={!selected}
        />
      </View>
    </View>
  );
}
