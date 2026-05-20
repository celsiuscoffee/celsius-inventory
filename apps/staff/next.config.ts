import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy packages to reduce serverless function cold starts
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
      "zod",
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
