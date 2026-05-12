/**
 * MissionCard — single active weekly mission for the Rewards screen.
 *
 * Matches the existing rewards.tsx visual vocabulary: rounded-2xl cards,
 * brand border, Peachi headings, terracotta progress dots.
 */

import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Sun, RefreshCw, MapPin, Users as UsersIcon, Clock, Coffee, Sparkles,
  ChevronRight, Target,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { type ActiveMission, missionProgressDots } from "../lib/rewards-v2";

const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  sun: Sun, refresh: RefreshCw, pin: MapPin, users: UsersIcon, clock: Clock,
  coffee: Coffee, sparkle: Sparkles,
};

type Props = { mission: ActiveMission | null };

export function MissionCard({ mission }: Props) {
  function openPicker() {
    Haptics.selectionAsync();
    router.push("/mission-picker" as never);
  }

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between mb-2.5 px-1">
        <Text
          className="text-espresso text-[12px] uppercase"
          style={{ fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 1.8 }}
        >
          This Week's Challenge
        </Text>
        {mission && (
          <Pressable
            onPress={openPicker}
            hitSlop={8}
            className="flex-row items-center gap-0.5 active:opacity-70"
          >
            <Text className="text-primary text-[12px]" style={{ fontFamily: "Peachi-Bold" }}>
              Swap
            </Text>
            <ChevronRight size={12} color="#C05040" strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {mission ? <ActiveCard mission={mission} /> : <EmptyCard onPress={openPicker} />}
    </View>
  );
}

function ActiveCard({ mission }: { mission: ActiveMission }) {
  const Icon = ICON_MAP[mission.icon] ?? Sparkles;
  const dots = missionProgressDots(mission.progress_current, mission.goal_threshold);

  return (
    <View
      className="bg-surface rounded-2xl border border-border p-4"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      <View
        className="rounded-xl items-center justify-center mb-3"
        style={{ width: 46, height: 46, backgroundColor: "#FBEBE8" }}
      >
        <Icon size={22} color="#C05040" strokeWidth={1.8} />
      </View>

      <Text
        className="text-espresso text-[18px] mb-1"
        style={{ fontFamily: "Peachi-Bold", letterSpacing: -0.3 }}
      >
        {mission.title}
      </Text>
      <Text
        className="text-muted-fg text-[13px] mb-3.5"
        style={{ fontFamily: "SpaceGrotesk_500Medium", lineHeight: 19 }}
      >
        {mission.description}
      </Text>

      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-row flex-1" style={{ gap: 5 }}>
          {dots.map((filled, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 2,
                backgroundColor: filled ? "#C05040" : "rgba(26,2,0,0.08)",
              }}
            />
          ))}
        </View>
        <Text
          className="text-muted-fg text-[12px]"
          style={{ fontFamily: "SpaceGrotesk_700Bold" }}
        >
          <Text className="text-espresso">{mission.progress_current}</Text>/{mission.goal_threshold}
        </Text>
      </View>
    </View>
  );
}

function EmptyCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl p-5 items-center active:opacity-70"
      style={{
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#C05040",
      }}
    >
      <View
        className="rounded-xl items-center justify-center mb-3"
        style={{ width: 46, height: 46, backgroundColor: "#FBEBE8" }}
      >
        <Target size={22} color="#C05040" strokeWidth={1.8} />
      </View>
      <Text
        className="text-espresso text-[17px] mb-1"
        style={{ fontFamily: "Peachi-Bold" }}
      >
        Pick this week's challenge
      </Text>
      <Text
        className="text-muted-fg text-[12px] text-center mb-3.5"
        style={{ fontFamily: "SpaceGrotesk_500Medium", lineHeight: 17 }}
      >
        One mission per week. Complete it, earn vouchers.
      </Text>
      <View className="bg-primary rounded-full flex-row items-center px-5 py-2.5" style={{ gap: 6 }}>
        <Text className="text-white text-[13px]" style={{ fontFamily: "Peachi-Bold" }}>
          Choose mission
        </Text>
        <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
