import { View, Text } from "react-native";
import { ClipboardList } from "lucide-react-native";
import { EspressoHeader } from "../components/EspressoHeader";
import { BottomNav } from "../components/BottomNav";

export default function OrdersTab() {
  return (
    <View className="flex-1 bg-background">
      <EspressoHeader title="Orders" showCart={false} />
      <View className="flex-1 items-center justify-center px-6">
        <ClipboardList size={48} color="#8E8E93" strokeWidth={1.25} />
        <Text className="text-espresso text-base font-bold mt-4">No past orders yet</Text>
        <Text className="text-muted-fg text-sm text-center mt-1">
          Once you place your first order, it'll show up here.
        </Text>
      </View>
      <BottomNav />
    </View>
  );
}
