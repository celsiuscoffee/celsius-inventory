import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false, // Avoid double-renders in dev on SUNMI
};

export default nextConfig;
