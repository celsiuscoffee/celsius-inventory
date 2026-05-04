import { View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  selected?: boolean;
};

export function Card({ children, onPress, className = "", selected = false }: Props) {
  const ringClass = selected ? "border-2 border-espresso" : "border border-border";
  const base = `bg-surface rounded-2xl p-4 ${ringClass}`;

  if (!onPress) {
    return <View className={`${base} ${className}`}>{children}</View>;
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      className={`${base} active:opacity-70 ${className}`}
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      {children}
    </Pressable>
  );
}
