import { useEffect, useState } from "react";
import { View, Image, type ImageStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Skeleton } from "./Skeleton";

/**
 * Image wrapper that always reads as intentional, never broken.
 *
 * Shows a Skeleton placeholder (animated grey shape, see Skeleton.tsx)
 * while the image loads, then fades the real image in over 200 ms.
 * The skeleton matches the image's exact dimensions + radius so the
 * layout is locked from the first frame — no jump when the image
 * lands. This is the LinkedIn / Slack / Claude pattern: structure
 * first, content arrives smoothly.
 *
 * No spinner, no fallback text by default — the skeleton itself IS
 * the loading state and it looks intentional. Pass `fallback` for
 * the no-source case (uri is null/undefined or load errors) if you
 * want product-name text instead of just the skeleton.
 */

type Props = {
  uri: string | null | undefined;
  width: number;
  height: number;
  borderRadius?: number;
  resizeMode?: "cover" | "contain";
  /** Optional content shown when uri is null OR the image errored.
   *  Centered + padded. Useful for product-name fallback text. */
  fallback?: React.ReactNode;
  style?: StyleProp<ImageStyle>;
};

const FADE_IN_MS = 200;

export function ProductImage({
  uri,
  width,
  height,
  borderRadius,
  resizeMode = "cover",
  fallback,
  style,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset on uri change — recycled rows in lists.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [uri]);

  // Fade the loaded image in over the skeleton.
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = loaded ? withTiming(1, { duration: FADE_IN_MS }) : 0;
  }, [loaded, fade]);
  const imageStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const noContent = !uri || errored;

  return (
    <View
      style={[
        { width, height, borderRadius, overflow: "hidden" },
        style,
      ]}
    >
      {/* Skeleton sits behind everything — visible while the image is
          in flight. Matches the wrapper's exact dimensions + radius
          so the transition to image is a simple opacity fade with no
          visible shape change. */}
      {!loaded && !noContent && (
        <Skeleton width={width} height={height} borderRadius={borderRadius ?? 0} />
      )}

      {/* Fallback content for the no-source / errored case. Sits on
          top of an inert background. */}
      {noContent && (
        <View
          style={{
            width,
            height,
            borderRadius,
            backgroundColor: "#FAF7F2",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 10,
          }}
        >
          {fallback}
        </View>
      )}

      {/* Actual image — always rendered when we have a uri (so onLoad
          fires); opacity 0 until loaded, then fades in. */}
      {!noContent && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              width,
              height,
            },
            imageStyle,
          ]}
        >
          <Image
            source={{ uri: uri as string }}
            style={{ width, height }}
            resizeMode={resizeMode}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </Animated.View>
      )}
    </View>
  );
}
