import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  turbopack: {
    root: "../..",
  },
};

export default withSentryConfig(nextConfig, {
  org: "celsius-coffee-sdn-bhd",
  project: "celsius-ops",
  silent: !process.env.CI,
  disableLogger: true,
  automaticVercelMonitors: true,
});
