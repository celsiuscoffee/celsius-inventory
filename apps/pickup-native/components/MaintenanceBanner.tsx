import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle } from "lucide-react-native";
import { getSetting } from "../lib/settings";

// Top banner shown app-wide when admin has flipped maintenance mode on
// from backoffice. Pickup orders keep working but customers see the
// message — useful for "Back at 11am after a brief outage" style notices.
export function MaintenanceBanner() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getSetting("maintenance").then((m) => {
      setVisible(Boolean(m.enabled && m.message));
      setMessage(m.message ?? "");
    });
  }, []);

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 10000,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#C05040",
      }}
    >
      <AlertCircle size={14} color="#FFFFFF" strokeWidth={2.5} />
      <Text
        style={{
          color: "#FFFFFF",
          fontFamily: "SpaceGrotesk_600SemiBold",
          fontSize: 12,
          flex: 1,
        }}
        numberOfLines={2}
      >
        {message}
      </Text>
    </View>
  );
}
