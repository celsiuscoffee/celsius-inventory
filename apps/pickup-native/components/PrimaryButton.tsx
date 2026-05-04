import { Pressable, Text, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "espresso" | "ghost";
  className?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  className = "",
}: Props) {
  const styles =
    variant === "espresso"
      ? "bg-espresso"
      : variant === "ghost"
      ? "bg-surface border border-border"
      : "bg-primary";
  const textColor =
    variant === "ghost" ? "text-espresso" : "text-white";

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      className={`${styles} rounded-full py-4 items-center justify-center active:opacity-80 ${
        disabled ? "opacity-40" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? "#160800" : "#FFFFFF"} />
      ) : (
        <Text className={`${textColor} font-bold text-base`}>{label}</Text>
      )}
    </Pressable>
  );
}
