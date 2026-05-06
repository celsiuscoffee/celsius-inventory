import { useEffect } from "react";
import { Linking } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";

/**
 * Forwards `celsiuscoffee://stripe-redirect` deep links to the Stripe
 * SDK so PaymentSheet resolves correctly when an FPX/3DS bank flow
 * returns to the app. Without this, expo-router consumes the URL and
 * Stripe's PaymentSheet never knows the bank approved the payment.
 *
 * Must live inside <StripeProvider> so useStripe() resolves.
 */
export function StripeUrlHandler() {
  const { handleURLCallback } = useStripe();

  useEffect(() => {
    const forward = async (url: string | null) => {
      if (!url) return;
      // Only forward URLs Stripe actually owns. Other deep links (push
      // notification taps, universal links) should be left alone.
      if (!url.startsWith("celsiuscoffee://stripe-redirect")) return;
      try {
        await handleURLCallback(url);
      } catch (e) {
        console.warn("[stripe] handleURLCallback failed", e);
      }
    };

    // Cold-launch path: if the app was opened by the redirect, the URL
    // is already queued before the listener attaches.
    Linking.getInitialURL().then(forward).catch(() => {});

    const sub = Linking.addEventListener("url", ({ url }) => {
      forward(url);
    });

    return () => sub.remove();
  }, [handleURLCallback]);

  return null;
}
