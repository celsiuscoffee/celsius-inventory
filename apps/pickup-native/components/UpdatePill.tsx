import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, AppState, Platform } from "react-native";
import * as Updates from "expo-updates";
import * as Haptics from "expo-haptics";
import { Sparkles } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FOREGROUND_POLL_MS = 30_000;

/**
 * Floating "Update ready — tap to refresh" pill.
 *
 * Without this, expo-updates only checks at cold launch and applies
 * new bundles on the *following* cold launch — customers don't see
 * an OTA push until they background-and-relaunch twice. With it,
 * we check on every foreground transition (and every 30s while the
 * app is open), pre-download the bundle in the background, then show
 * a non-intrusive pill the customer can tap when they're between
 * tasks.
 *
 * Never auto-reloads — that would interrupt a checkout. The customer
 * decides when to refresh.
 *
 * Dev builds don't have a real updates client, so we silently no-op
 * (Updates.isEnabled is false in Expo Go / dev builds).
 */
export function UpdatePill() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const checking = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;

    const check = async () => {
      if (checking.current || ready) return;
      checking.current = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          setReady(true);
        }
      } catch (e) {
        // Network blips are normal; keep silent so console isn't noisy
        // in offline / poor-signal moments.
      } finally {
        checking.current = false;
      }
    };

    // Check immediately on mount, on every foreground, and every 30s
    // while the app is in the foreground. Three separate triggers
    // because a customer who never backgrounds the app would otherwise
    // never hear about new updates after the initial cold-launch check.
    check();

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });

    const interval = setInterval(check, FOREGROUND_POLL_MS);

    return () => {
      appSub.remove();
      clearInterval(interval);
    };
  }, [ready]);

  if (!ready) return null;

  const onTap = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Updates.reloadAsync();
    } catch {
      // If reload fails, app keeps running on the old bundle — pill
      // stays visible so the customer can retry.
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // Sit just above the bottom tab bar (~64px tall) plus the
        // home-indicator inset, so the pill never collides with nav.
        bottom: 64 + insets.bottom + 12,
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={onTap}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#160800",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          ...(Platform.OS === "android" ? { borderWidth: 1, borderColor: "#2a1408" } : {}),
        }}
      >
        <Sparkles size={14} color="#FBBF24" fill="#FBBF24" strokeWidth={2} />
        <Text
          style={{
            color: "#FFFFFF",
            fontFamily: "Peachi-Bold",
            fontSize: 13,
            marginLeft: 8,
            letterSpacing: 0.3,
          }}
        >
          Update ready · tap to refresh
        </Text>
      </Pressable>
    </View>
  );
}
