import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.storehub.me",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "celsius-coffee-sdn-bhd",
  project: "celsius-ops",
  silent: !process.env.CI,
  disableLogger: true,
  automaticVercelMonitors: true,
});
