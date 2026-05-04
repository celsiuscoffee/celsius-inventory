import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, router } from "expo-router";
import {
  User,
  LogOut,
  ChevronRight,
  Phone,
  ArrowLeft,
  ShoppingBag,
  HelpCircle,
  Shield,
  Trash2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { EspressoHeader } from "../components/EspressoHeader";
import { BottomNav } from "../components/BottomNav";
import { useApp } from "../lib/store";
import { api } from "../lib/api";
import { fetchMember } from "../lib/rewards";

function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+6${digits}`;
  return `+60${digits}`;
}

function isValidLocalPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  // Malaysian mobile: at least 9 digits after country code
  if (digits.startsWith("60")) return digits.length >= 11;
  if (digits.startsWith("0")) return digits.length >= 10;
  return digits.length >= 9;
}

export default function AccountTab() {
  const phone = useApp((s) => s.phone);
  const setPhone = useApp((s) => s.setPhone);
  const setLoyaltyId = useApp((s) => s.setLoyaltyId);

  const handleVerified = async (p: string) => {
    setPhone(p);
    // Fetch loyalty member ID so points can be credited on orders.
    try {
      const m = await fetchMember(p);
      setLoyaltyId(m?.id ?? null);
    } catch {
      // Member doesn't exist yet — first order will create them server-side
    }
  };

  const handleSignOut = () => {
    setPhone("");
    setLoyaltyId(null);
  };

  if (phone) return <SignedIn phone={phone} onSignOut={handleSignOut} />;
  return <SignIn onVerified={handleVerified} />;
}

function SignedIn({ phone, onSignOut }: { phone: string; onSignOut: () => void }) {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Account" showCart={false} />
      <View className="px-4 pt-4 gap-3">
        <View className="bg-surface rounded-2xl border border-border p-4 flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
            <User size={22} color="#C05040" />
          </View>
          <View className="flex-1">
            <Text
              className="text-espresso text-base"
              style={{ fontFamily: "Peachi-Bold" }}
            >
              {phone}
            </Text>
            <Text
              className="text-muted-fg text-xs mt-0.5"
              style={{ fontFamily: "SpaceGrotesk_400Regular" }}
            >
              Phone-verified
            </Text>
          </View>
        </View>

        <NavRow
          icon={ShoppingBag}
          label="My orders"
          onPress={() => router.push("/orders")}
        />
        <NavRow
          icon={HelpCircle}
          label="Support"
          onPress={() => router.push("/support")}
        />
        <NavRow
          icon={Shield}
          label="Privacy policy"
          onPress={() => router.push("/privacy")}
        />
        <NavRow
          icon={Trash2}
          label="Delete account"
          onPress={() => router.push("/account-delete")}
        />

        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onSignOut();
          }}
          className="bg-surface rounded-2xl border border-border p-4 flex-row items-center gap-3 active:opacity-70 mt-2"
        >
          <View className="w-9 h-9 rounded-lg bg-background items-center justify-center">
            <LogOut size={18} color="#C05040" />
          </View>
          <Text
            className="text-primary flex-1"
            style={{ fontFamily: "Peachi-Bold" }}
          >
            Sign out
          </Text>
          <ChevronRight size={18} color="#8E8E93" />
        </Pressable>
      </View>
      <BottomNav />
    </View>
  );
}

function NavRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl border border-border p-4 flex-row items-center gap-3 active:opacity-70"
    >
      <View className="w-9 h-9 rounded-lg bg-background items-center justify-center">
        <Icon size={18} color="#160800" strokeWidth={1.75} />
      </View>
      <Text
        className="text-espresso flex-1"
        style={{ fontFamily: "Peachi-Bold" }}
      >
        {label}
      </Text>
      <ChevronRight size={18} color="#8E8E93" />
    </Pressable>
  );
}

type Step = "phone" | "code";

function SignIn({ onVerified }: { onVerified: (phone: string) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [normalised, setNormalised] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!isValidLocalPhone(phoneInput)) {
      setError("Enter a valid Malaysian phone number");
      return;
    }
    setError(null);
    setLoading(true);
    const norm = normalisePhone(phoneInput);
    try {
      await api.sendOtp(norm);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNormalised(norm);
      setStep("code");
    } catch (e: any) {
      setError(e?.message ?? "Could not send code. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!normalised) return;
    if (code.length < 4) {
      setError("Enter the 6-digit code");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.verifyOtp(normalised, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onVerified(normalised);
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="bg-background"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Sign in" showCart={false} />

      <View className="flex-1 px-5 pt-8">
        {step === "phone" ? (
          <>
            <View
              className="bg-primary/10 items-center justify-center mb-4"
              style={{ width: 64, height: 64, borderRadius: 32 }}
            >
              <Phone size={28} color="#C05040" strokeWidth={1.5} />
            </View>
            <Text
              className="text-espresso text-2xl"
              style={{ fontFamily: "Peachi-Bold" }}
            >
              What's your number?
            </Text>
            <Text
              className="text-muted-fg text-sm mt-1.5 mb-6"
              style={{ fontFamily: "SpaceGrotesk_400Regular" }}
            >
              We'll text you a 6-digit code to verify it's you.
            </Text>

            <View className="bg-surface rounded-2xl border border-border px-4 py-3 flex-row items-center gap-2">
              <Text
                className="text-muted-fg text-base"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                +60
              </Text>
              <TextInput
                value={phoneInput.replace(/^(\+?60|0)/, "")}
                onChangeText={(t) => {
                  setPhoneInput(t);
                  if (error) setError(null);
                }}
                placeholder="12 345 6789"
                placeholderTextColor="#8E8E93"
                keyboardType="phone-pad"
                autoFocus
                className="flex-1 text-espresso text-base"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
                maxLength={11}
              />
            </View>
            {error && (
              <Text
                className="text-primary text-xs mt-2 px-1"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                {error}
              </Text>
            )}

            <Pressable
              disabled={loading || !isValidLocalPhone(phoneInput)}
              onPress={handleSend}
              className={`mt-6 rounded-full items-center justify-center flex-row gap-2 ${
                loading || !isValidLocalPhone(phoneInput)
                  ? "bg-espresso/40"
                  : "bg-espresso active:opacity-80"
              }`}
              style={{ paddingVertical: 16 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className="text-white text-base"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  Send code
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="flex-row items-center gap-1 active:opacity-60 mb-4 -ml-1 self-start"
              hitSlop={8}
            >
              <ArrowLeft size={16} color="#6E6E73" />
              <Text
                className="text-muted-fg text-sm"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                Back
              </Text>
            </Pressable>

            <Text
              className="text-espresso text-2xl"
              style={{ fontFamily: "Peachi-Bold" }}
            >
              Enter the code
            </Text>
            <Text
              className="text-muted-fg text-sm mt-1.5 mb-6"
              style={{ fontFamily: "SpaceGrotesk_400Regular" }}
            >
              Sent to {normalised}. Should arrive in a few seconds.
            </Text>

            <View className="bg-surface rounded-2xl border border-border px-4 py-3">
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                placeholder="••••••"
                placeholderTextColor="#C5C5C8"
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                textAlign="center"
                className="text-espresso text-2xl tracking-[8px]"
                style={{ fontFamily: "Peachi-Bold" }}
              />
            </View>
            {error && (
              <Text
                className="text-primary text-xs mt-2 px-1 text-center"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                {error}
              </Text>
            )}

            <Pressable
              disabled={loading || code.length < 4}
              onPress={handleVerify}
              className={`mt-6 rounded-full items-center justify-center flex-row gap-2 ${
                loading || code.length < 4
                  ? "bg-espresso/40"
                  : "bg-espresso active:opacity-80"
              }`}
              style={{ paddingVertical: 16 }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className="text-white text-base"
                  style={{ fontFamily: "Peachi-Bold" }}
                >
                  Verify
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleSend}
              disabled={loading}
              className="mt-3 self-center active:opacity-60"
              hitSlop={8}
            >
              <Text
                className="text-muted-fg text-sm"
                style={{ fontFamily: "SpaceGrotesk_500Medium" }}
              >
                Resend code
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <BottomNav />
    </KeyboardAvoidingView>
  );
}
