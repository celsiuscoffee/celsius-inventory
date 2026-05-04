import { View, Text, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { EspressoHeader } from "../components/EspressoHeader";

const fontBody = { fontFamily: "SpaceGrotesk_400Regular" } as const;
const fontBoldBody = { fontFamily: "SpaceGrotesk_700Bold" } as const;
const fontPeachi = { fontFamily: "Peachi-Bold" } as const;

export default function Privacy() {
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <EspressoHeader title="Privacy policy" showBack showCart={false} />
      <ScrollView contentContainerClassName="px-5 py-5 gap-5 pb-20">
        <View>
          <Text className="text-espresso text-xl" style={fontPeachi}>
            Privacy Policy
          </Text>
          <Text
            className="text-muted-fg text-xs mt-1"
            style={fontBody}
          >
            Last updated: 29 April 2026
          </Text>
        </View>

        <Section title="1. Data Controller">
          <P>
            Celsius Coffee Sdn. Bhd. operates the Celsius Coffee Loyalty Programme, the order.celsiuscoffee.com web service, and the Celsius Coffee mobile applications for iOS and Android. This policy explains how we collect, use, and protect your personal data in accordance with the Personal Data Protection Act 2010 (PDPA) of Malaysia.
          </P>
        </Section>

        <Section title="2. Data We Collect">
          <Bullet><B>Phone number</B> — required for account identification and OTP verification</Bullet>
          <Bullet><B>Name</B> — for personalisation (optional)</Bullet>
          <Bullet><B>Email</B> — for communications (optional)</Bullet>
          <Bullet><B>Birthday</B> — for birthday rewards (optional)</Bullet>
          <Bullet><B>Transaction history</B> — points earned, redeemed, and visit records</Bullet>
          <Bullet><B>Push notification token</B> — device-specific identifier used solely to deliver order status notifications and rewards alerts</Bullet>
          <Bullet><B>Device and diagnostic data</B> — OS version, app version, crash logs, and anonymous usage events used to maintain app stability</Bullet>
          <P>
            We do not collect precise location, contacts, photos, or any advertising identifiers. We do not track you across other companies' apps or websites.
          </P>
        </Section>

        <Section title="3. How We Use Your Data">
          <Bullet>To manage your loyalty points and rewards</Bullet>
          <Bullet>To send OTP codes for account verification</Bullet>
          <Bullet>To send promotional SMS (only with consent; opt out anytime)</Bullet>
          <Bullet>To provide birthday rewards and special offers</Bullet>
          <Bullet>To send order status push notifications — only with your permission</Bullet>
          <Bullet>To improve our services through aggregated analytics</Bullet>
        </Section>

        <Section title="4. Third-Party Data Sharing">
          <P>We share limited data with:</P>
          <Bullet><B>SMS providers</B> (SMS123 / SMS Niaga) — your phone number and message content</Bullet>
          <Bullet><B>Supabase</B> — cloud database for secure data storage</Bullet>
          <Bullet><B>Apple Push Notification service (APNs)</B> and <B>Firebase Cloud Messaging (FCM)</B> — only the device push token is shared</Bullet>
          <P>We do not sell your personal data to any third party.</P>
        </Section>

        <Section title="5. SMS Marketing & Opt-Out">
          <P>
            You may receive promotional SMS messages. You can opt out at any time by informing staff at any outlet or contacting us. Opting out of marketing will not affect your loyalty account or transactional messages (such as OTP codes).
          </P>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your personal data for as long as your loyalty account is active. OTP codes are automatically deleted after verification or expiry. SMS logs are retained for 90 days for troubleshooting. You may request deletion at any time.
          </P>
        </Section>

        <Section title="7. Your Rights (PDPA Sections 12 & 13)">
          <Bullet><B>Access</B> — know what personal data we hold</Bullet>
          <Bullet><B>Correction</B> — request corrections to your data</Bullet>
          <Bullet><B>Deletion</B> — request deletion of your account and data</Bullet>
          <Bullet><B>Withdraw Consent</B> — for marketing communications at any time</Bullet>
        </Section>

        <Section title="8. Data Security">
          <P>
            We implement appropriate security measures including encrypted connections (HTTPS), hashed passwords and PINs, and access controls on our systems.
          </P>
        </Section>

        <Section title="9. Account & Data Deletion">
          <P>
            Email <B>barista@celsiuscoffee.com</B> from the address linked to your account, or visit any Celsius Coffee outlet with photo ID. We will permanently delete your account, points balance, transaction history, and push tokens within 30 days of a verified request.
          </P>
        </Section>

        <Section title="10. Children's Privacy">
          <P>
            The Celsius Coffee app is not directed to children under 13. We do not knowingly collect personal data from children under 13.
          </P>
        </Section>

        <Section title="11. Contact Us">
          <P>
            For any enquiries about your personal data, contact us at any Celsius Coffee outlet or email <B>barista@celsiuscoffee.com</B>.
          </P>
          <P>
            <B>Celsius Coffee Sdn. Bhd.</B>{"\n"}D-U-N-S: 47-329-1793
          </P>
        </Section>

        <Text
          className="text-muted-fg text-[11px] mt-4 leading-[16px] border-t border-border pt-4"
          style={fontBody}
        >
          Published in compliance with the Personal Data Protection Act 2010 (Act 709) of Malaysia.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-espresso text-[15px] mb-2" style={fontPeachi}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="text-espresso text-[13px] leading-[20px] mt-1"
      style={fontBody}
    >
      {children}
    </Text>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={fontBoldBody}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2 mb-1 mt-0.5">
      <Text className="text-primary text-[13px]">•</Text>
      <Text
        className="text-espresso text-[13px] flex-1 leading-[20px]"
        style={fontBody}
      >
        {children}
      </Text>
    </View>
  );
}
