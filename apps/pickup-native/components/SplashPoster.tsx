import { useEffect, useState } from "react";
import { View, Image, Pressable, Text, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { getSplashPoster, type SplashPoster as Poster } from "../lib/splash";

type Props = { onDone: () => void };

export function SplashPoster({ onDone }: Props) {
  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(true);
  const { width: w, height: h } = useWindowDimensions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getSplashPoster();
      if (cancelled) return;
      if (!p) {
        onDone();
        return;
      }
      setPoster(p);
      setLoading(false);
      const t = setTimeout(onDone, p.durationMs);
      return () => clearTimeout(t);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !poster) return null;

  const handleTap = () => {
    if (poster.deeplink) {
      onDone();
      // Allow router to push the deeplink target
      setTimeout(() => router.push(poster.deeplink as any), 50);
    }
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: w,
        height: h,
        backgroundColor: "#160800",
        zIndex: 9999,
      }}
    >
      <Pressable onPress={handleTap} style={{ width: "100%", height: "100%" }}>
        <Image
          source={{ uri: poster.imageUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </Pressable>
      <Pressable
        onPress={onDone}
        hitSlop={20}
        style={{
          position: "absolute",
          top: 60,
          right: 20,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={16} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
      {poster.deeplink && (
        <View
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "SpaceGrotesk_500Medium",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Tap to open
          </Text>
        </View>
      )}
    </View>
  );
}
