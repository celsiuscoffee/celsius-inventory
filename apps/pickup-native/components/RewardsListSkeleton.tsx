import { View } from "react-native";
import { Skeleton } from "./Skeleton";

/**
 * Layout-shaped skeleton for the rewards page card list. Mirrors
 * the shared single-row anatomy used by ChallengeCard / VoucherRow /
 * CatalogCard / ClaimableCard — icon-or-image-on-left, text-on-right,
 * action chip on the far right.
 *
 * Renders a small stack of rows so the user immediately sees "this
 * is a list of rewards loading" instead of a centred spinner that
 * could mean anything.
 */

function RewardCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(26,8,0,0.08)",
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Icon / image area */}
      <Skeleton width={48} height={48} borderRadius={12} />

      {/* Text stack */}
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={"70%"} height={14} pill />
        <Skeleton width={"45%"} height={11} pill />
      </View>

      {/* Right-side action chip */}
      <Skeleton width={64} height={28} borderRadius={14} />
    </View>
  );
}

export function RewardsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <RewardCardSkeleton key={i} />
      ))}
    </View>
  );
}
