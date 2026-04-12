import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.celsius.pos",
  appName: "Celsius POS",
  // Load from deployed server (API routes need a server)
  server: {
    // Development: point to local dev server
    // Production: point to deployed URL (e.g. pos.celsiuscoffee.com)
    url: "https://celsius-pos.vercel.app",
    cleartext: true, // Allow HTTP for local dev
    androidScheme: "https",
  },
  android: {
    // Allow mixed content for local printer bridge (HTTP localhost)
    allowMixedContent: true,
    // Fullscreen immersive mode for POS kiosk
    backgroundColor: "#0a0a0a",
  },
  plugins: {},
};

export default config;
